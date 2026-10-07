package com.dike.planning.application;

import com.dike.community.CommunityAccess;
import com.dike.community.SocialAccessPolicy;
import com.dike.planning.*;
import com.dike.planning.domain.RidePost;
import com.dike.planning.domain.RidePost.*;
import com.dike.shared.api.ApiException;
import com.dike.shared.application.AtomicCommands;
import com.dike.shared.outbox.OutboxPublisher;
import java.time.Clock;
import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PostService implements PostAccess {
  private final PostStore store;
  private final JourneySources journeys;
  private final TripSource trips;
  private final PostAccounts accounts;
  private final CommunityAccess communities;
  private final SocialAccessPolicy social;
  private final AtomicCommands commands;
  private final OutboxPublisher outbox;
  private final Clock clock;

  public PostService(
      PostStore store,
      JourneySources journeys,
      TripSource trips,
      PostAccounts accounts,
      CommunityAccess communities,
      SocialAccessPolicy social,
      AtomicCommands commands,
      OutboxPublisher outbox,
      Clock clock) {
    this.store = store;
    this.journeys = journeys;
    this.trips = trips;
    this.accounts = accounts;
    this.communities = communities;
    this.social = social;
    this.commands = commands;
    this.outbox = outbox;
    this.clock = clock;
  }

  public record Create(
      Type type,
      String sourceId,
      long sourceVersion,
      String visibility,
      String communityId,
      String note) {}

  public record Edit(long version, String visibility, String communityId, String note) {}

  public record View(
      String id,
      String ownerId,
      String type,
      String status,
      String visibility,
      String communityId,
      String originLabel,
      String destinationLabel,
      String vehicleType,
      Instant departureAt,
      Instant expiresAt,
      String note,
      long version,
      long termsVersion,
      Integer remainingSeats,
      Long contributionPerKm) {}

  public record Page(List<View> items, String nextCursor) {}

  public View create(String actor, Create input, String key) {
    verified(actor);
    validate(input.visibility(), input.communityId(), input.note(), actor);
    String id =
        commands.execute(
            actor,
            "post.create",
            key,
            input.toString(),
            () -> {
              Instant now = clock.instant();
              RidePost post;
              if (input.type() == Type.NEED_RIDE) {
                var source =
                    journeys
                        .intent(actor, input.sourceId())
                        .filter(i -> i.ownerId().equals(actor))
                        .orElseThrow(
                            () ->
                                error(
                                    "JOURNEY_SOURCE_UNAVAILABLE", HttpStatus.SERVICE_UNAVAILABLE));
                if (source.version() != input.sourceVersion()) throw conflict();
                post =
                    new RidePost(
                        UUID.randomUUID().toString(),
                        actor,
                        input.type(),
                        source.id(),
                        source.version(),
                        Status.DRAFT,
                        input.visibility(),
                        input.communityId(),
                        source.originLabel(),
                        source.destinationLabel(),
                        source.vehicleType(),
                        source.routeId(),
                        source.departureAt(),
                        source.latestDepartureAt(),
                        input.note(),
                        0,
                        0,
                        null,
                        null);
              } else if (input.type() == Type.OFFER_RIDE) {
                var source =
                    trips
                        .offer(input.sourceId())
                        .filter(t -> t.ownerId().equals(actor))
                        .orElseThrow(PostService::missing);
                if (source.version() != input.sourceVersion()) throw conflict();
                post =
                    new RidePost(
                        UUID.randomUUID().toString(),
                        actor,
                        input.type(),
                        source.id(),
                        source.version(),
                        Status.DRAFT,
                        source.visibility(),
                        source.communityId(),
                        source.originLabel(),
                        source.destinationLabel(),
                        source.vehicleType(),
                        source.routeId(),
                        source.departureAt(),
                        source.departureAt(),
                        input.note(),
                        0,
                        source.termsVersion(),
                        null,
                        null);
              } else throw error("INVALID_POST_TYPE", HttpStatus.BAD_REQUEST);
              store.insert(post);
              return post.id();
            });
    return detail(actor, id);
  }

  public View publish(String actor, String id, long version, String key) {
    verified(actor);
    commands.execute(
        actor,
        "post.publish",
        key,
        id + ":" + version,
        () -> {
          RidePost p = owned(actor, id, version);
          commands.fence("intent", p.sourceId());
          if (p.status() != Status.DRAFT || !clock.instant().isBefore(p.expiresAt()))
            throw conflict();
          validate(p.visibility(), p.communityId(), p.note(), actor);
          if (p.type() == Type.NEED_RIDE) {
            var source =
                journeys
                    .intent(actor, p.sourceId())
                    .orElseThrow(
                        () -> error("JOURNEY_SOURCE_UNAVAILABLE", HttpStatus.SERVICE_UNAVAILABLE));
            if (source.version() != p.sourceVersion()) throw conflict();
            if (store.bySource(p.sourceId()).stream()
                .anyMatch(
                    other ->
                        !other.id().equals(id)
                            && (other.status() == Status.OPEN || other.status() == Status.MATCHED)))
              throw conflict();
          } else {
            var trip = trips.offer(p.sourceId()).orElseThrow(PostService::missing);
            if (!trip.status().equals("OPEN")
                || trip.remainingSeats() < 1
                || trip.termsVersion() != p.termsVersion()) throw conflict();
          }
          var next = p.change(Status.OPEN, null, clock.instant());
          store.save(p, next);
          event(next, "post.published");
          return id;
        });
    return detail(actor, id);
  }

  public View edit(String actor, String id, Edit input, String key) {
    verified(actor);
    validate(input.visibility(), input.communityId(), input.note(), actor);
    commands.execute(
        actor,
        "post.edit",
        key,
        id + input,
        () -> {
          var p = owned(actor, id, input.version());
          commands.fence("intent", p.sourceId());
          if (p.status() != Status.DRAFT && p.status() != Status.OPEN) throw conflict();
          if (p.type() == Type.OFFER_RIDE
              && (!p.visibility().equals(input.visibility())
                  || !Objects.equals(p.communityId(), input.communityId())))
            throw error("EDIT_TRIP_VISIBILITY", HttpStatus.CONFLICT);
          boolean changed =
              !p.visibility().equals(input.visibility())
                  || !Objects.equals(p.communityId(), input.communityId());
          var next =
              new RidePost(
                  p.id(),
                  p.ownerId(),
                  p.type(),
                  p.sourceId(),
                  p.sourceVersion(),
                  p.status(),
                  input.visibility(),
                  input.communityId(),
                  p.originLabel(),
                  p.destinationLabel(),
                  p.vehicleType(),
                  p.routeId(),
                  p.departureAt(),
                  p.expiresAt(),
                  input.note(),
                  p.version() + 1,
                  p.termsVersion() + (changed ? 1 : 0),
                  p.closureReason(),
                  p.publishedAt());
          store.save(p, next);
          event(next, "post.changed");
          return id;
        });
    return detail(actor, id);
  }

  public View close(String actor, String id, long version, String key) {
    active(actor);
    commands.execute(
        actor,
        "post.close",
        key,
        id + ":" + version,
        () -> {
          var p = owned(actor, id, version);
          commands.fence("intent", p.sourceId());
          if (p.status() != Status.OPEN
              && p.status() != Status.DRAFT
              && p.status() != Status.MATCHED) throw conflict();
          var next = p.change(Status.CLOSED, "OWNER_CLOSED", clock.instant());
          store.save(p, next);
          event(next, "post.closed");
          return id;
        });
    return detail(actor, id);
  }

  public View detail(String actor, String id) {
    active(actor);
    var p = store.find(id).orElseThrow(PostService::missing);
    if (!readable(actor, p)) throw missing();
    return view(p);
  }

  public Page feed(
      String actor,
      String tab,
      String after,
      int limit,
      String vehicle,
      Instant from,
      Instant until) {
    active(actor);
    if (limit < 1 || limit > 50 || !List.of("latest", "friends", "community", "mine").contains(tab))
      throw error("INVALID_FEED_QUERY", HttpStatus.BAD_REQUEST);
    if (after != null && !after.matches("[A-Za-z0-9-]{1,100}"))
      throw error("INVALID_CURSOR", HttpStatus.BAD_REQUEST);
    var rows = store.scan(after, limit, tab.equals("mine") ? actor : null);
    var result =
        rows.stream()
            .filter(p -> tab.equals("mine") || p.live(clock.instant()))
            .filter(p -> readable(actor, p))
            .filter(p -> !tab.equals("friends") || social.friends(actor, p.ownerId()))
            .filter(
                p ->
                    !tab.equals("community")
                        || (p.communityId() != null && communities.member(actor, p.communityId())))
            .filter(p -> vehicle == null || vehicle.equals(p.vehicleType()))
            .filter(p -> from == null || !p.departureAt().isBefore(from))
            .filter(p -> until == null || !p.departureAt().isAfter(until))
            .map(this::view)
            .toList();
    return new Page(result, rows.size() == limit ? rows.getLast().id() : null);
  }

  public void save(String actor, String id, boolean saved) {
    active(actor);
    if (saved) detail(actor, id);
    store.saveFor(actor, id, saved);
  }

  public Page saved(String actor, String after, int limit) {
    active(actor);
    if (limit < 1 || limit > 50) throw error("INVALID_PAGE", HttpStatus.BAD_REQUEST);
    var ids = store.saved(actor, after, limit);
    var views = new ArrayList<View>();
    for (String id : ids)
      store.find(id).filter(p -> readable(actor, p)).ifPresent(p -> views.add(view(p)));
    return new Page(List.copyOf(views), ids.size() == limit ? ids.getLast() : null);
  }

  public boolean readable(String actor, RidePost p) {
    if (actor.equals(p.ownerId())) return true;
    if (p.status() == Status.DRAFT || !accounts.active(p.ownerId())) return false;
    if (!social.canRead(
        actor,
        p.ownerId(),
        SocialAccessPolicy.Visibility.valueOf(p.visibility()),
        p.communityId() != null && communities.member(actor, p.communityId()))) return false;
    if (p.type() == Type.OFFER_RIDE) {
      var source = trips.offer(p.sourceId());
      return source.isPresent()
          && social.canRead(
              actor,
              p.ownerId(),
              SocialAccessPolicy.Visibility.valueOf(source.get().visibility()),
              source.get().communityId() != null
                  && communities.member(actor, source.get().communityId()));
    }
    return true;
  }

  private View view(RidePost p) {
    var trip =
        p.type() == Type.OFFER_RIDE
            ? trips.offer(p.sourceId()).orElseThrow(PostService::missing)
            : null;
    String status = p.status().name();
    if (p.status() == Status.OPEN && !p.live(clock.instant())) status = "EXPIRED";
    if (trip != null && p.status() == Status.OPEN && !trip.status().equals("OPEN"))
      status = trip.status().equals("FULL") ? "MATCHED" : "CLOSED";
    return new View(
        p.id(),
        p.ownerId(),
        p.type().name(),
        status,
        trip == null ? p.visibility() : trip.visibility(),
        trip == null ? p.communityId() : trip.communityId(),
        p.originLabel(),
        p.destinationLabel(),
        p.vehicleType(),
        p.departureAt(),
        p.expiresAt(),
        p.note(),
        p.version(),
        p.termsVersion(),
        trip == null ? null : trip.remainingSeats(),
        trip == null ? null : trip.contributionPerKm());
  }

  public Terms requireNeed(String viewer, String id) {
    var p = store.find(id).orElseThrow(PostService::missing);
    if (p.type() != Type.NEED_RIDE || !p.live(clock.instant()) || !readable(viewer, p))
      throw missing();
    return new Terms(
        p.id(),
        p.ownerId(),
        p.sourceId(),
        p.version(),
        p.termsVersion(),
        p.visibility(),
        p.communityId(),
        p.routeId());
  }

  public void requireReadable(String viewer, String id) {
    detail(viewer, id);
  }

  public void requireOpenOffer(String viewer, String tripId) {
    commands.fence("intent", tripId);
    if (store.bySource(tripId).stream()
        .noneMatch(
            p -> p.type() == Type.OFFER_RIDE && p.live(clock.instant()) && readable(viewer, p)))
      throw missing();
  }

  @Transactional(propagation = Propagation.MANDATORY)
  public void book(String id, long terms) {
    var p = store.find(id).orElseThrow(PostService::missing);
    if (!p.live(clock.instant()) || p.termsVersion() != terms) throw conflict();
    var next = p.change(Status.MATCHED, "BOOKED", clock.instant());
    store.save(p, next);
    event(next, "post.matched");
  }

  @Transactional(propagation = Propagation.MANDATORY)
  public void reopenOffer(String tripId, boolean full) {
    for (var p : store.bySource(tripId))
      if (p.type() == Type.OFFER_RIDE) {
        if (full && p.status() == Status.OPEN)
          store.save(p, p.change(Status.MATCHED, "AUTO_FULL", clock.instant()));
        else if (!full
            && p.status() == Status.MATCHED
            && "AUTO_FULL".equals(p.closureReason())
            && clock.instant().isBefore(p.expiresAt()))
          store.save(p, p.change(Status.OPEN, null, clock.instant()));
      }
  }

  @Transactional(propagation = Propagation.MANDATORY)
  public void invalidateTrip(String tripId) {
    for (var p : store.bySource(tripId))
      if (p.type() == Type.OFFER_RIDE
          && (p.status() == Status.OPEN || p.status() == Status.MATCHED))
        store.save(p, p.change(Status.CLOSED, "TRIP_CLOSED", clock.instant()));
  }

  @Transactional(propagation = Propagation.MANDATORY)
  public String draftAgain(String actor, String postId) {
    verified(actor);
    var old =
        store
            .find(postId)
            .filter(p -> p.ownerId().equals(actor) && p.type() == Type.NEED_RIDE)
            .orElseThrow(PostService::missing);
    var source =
        journeys
            .intent(actor, old.sourceId())
            .filter(i -> i.ownerId().equals(actor))
            .orElseThrow(() -> error("JOURNEY_SOURCE_UNAVAILABLE", HttpStatus.SERVICE_UNAVAILABLE));
    if (!clock.instant().isBefore(source.latestDepartureAt())) throw conflict();
    if (old.status() == Status.MATCHED) {
      var closed = old.change(Status.CLOSED, "FIND_AGAIN", clock.instant());
      store.save(old, closed);
      event(closed, "post.closed");
    }
    var draft =
        new RidePost(
            UUID.randomUUID().toString(),
            actor,
            Type.NEED_RIDE,
            source.id(),
            source.version(),
            Status.DRAFT,
            old.visibility(),
            old.communityId(),
            source.originLabel(),
            source.destinationLabel(),
            source.vehicleType(),
            source.routeId(),
            source.departureAt(),
            source.latestDepartureAt(),
            old.note(),
            0,
            0,
            null,
            null);
    store.insert(draft);
    return draft.id();
  }

  private RidePost owned(String actor, String id, long version) {
    var p = store.find(id).filter(v -> v.ownerId().equals(actor)).orElseThrow(PostService::missing);
    if (p.version() != version) throw conflict();
    return p;
  }

  private void validate(String visibility, String community, String note, String actor) {
    if (visibility == null
        || !List.of("PUBLIC", "FRIENDS", "COMMUNITY").contains(visibility)
        || note == null
        || note.length() > 500) throw error("INVALID_POST", HttpStatus.BAD_REQUEST);
    if (visibility.equals("COMMUNITY")
        && (community == null || !communities.member(actor, community)))
      throw error("MEMBERSHIP_REQUIRED", HttpStatus.FORBIDDEN);
  }

  private void active(String actor) {
    if (!accounts.active(actor)) throw error("ACCOUNT_UNAVAILABLE", HttpStatus.FORBIDDEN);
  }

  private void verified(String actor) {
    active(actor);
    if (!accounts.verified(actor)) throw error("VERIFICATION_REQUIRED", HttpStatus.FORBIDDEN);
  }

  private void event(RidePost p, String name) {
    outbox.publish(name, "RidePost", p.id(), 1, Map.of("postId", p.id(), "version", p.version()));
  }

  private static ApiException conflict() {
    return error("POST_CHANGED", HttpStatus.CONFLICT);
  }

  private static ApiException missing() {
    return error("RESOURCE_NOT_AVAILABLE", HttpStatus.NOT_FOUND);
  }

  private static ApiException error(String code, HttpStatus status) {
    return new ApiException(
        status, code, "Không thể thực hiện thao tác bài đăng; vui lòng tải lại");
  }
}
