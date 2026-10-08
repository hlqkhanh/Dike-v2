package com.dike.ride.application;

import com.dike.community.*;
import com.dike.planning.*;
import com.dike.ride.*;
import com.dike.ride.domain.*;
import com.dike.shared.api.ApiException;
import com.dike.shared.application.AtomicCommands;
import com.dike.shared.outbox.OutboxPublisher;
import java.time.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class RideService {
  private final RideStore store;
  private final RideResources resources;
  private final RideEligibility eligibility;
  private final JourneySources journeys;
  private final PostAccess posts;
  private final SocialAccessPolicy social;
  private final SocialAcceptanceGuard socialGuard;
  private final CommunityAccess communities;
  private final AtomicCommands commands;
  private final OutboxPublisher outbox;
  private final BoardingSecrets secrets;
  private final Clock clock;

  public RideService(
      RideStore store,
      RideResources resources,
      RideEligibility eligibility,
      JourneySources journeys,
      PostAccess posts,
      SocialAccessPolicy social,
      SocialAcceptanceGuard socialGuard,
      CommunityAccess communities,
      AtomicCommands commands,
      OutboxPublisher outbox,
      BoardingSecrets secrets,
      Clock clock) {
    this.store = store;
    this.resources = resources;
    this.eligibility = eligibility;
    this.journeys = journeys;
    this.posts = posts;
    this.social = social;
    this.socialGuard = socialGuard;
    this.communities = communities;
    this.commands = commands;
    this.outbox = outbox;
    this.secrets = secrets;
    this.clock = clock;
  }

  @io.swagger.v3.oas.annotations.media.Schema(name = "TripCreate")
  public record CreateTrip(
      String vehicleId,
      String routeId,
      Instant departureAt,
      String originLabel,
      String destinationLabel,
      int offeredSeats,
      long contributionPerKm,
      long detourMeters,
      long detourSeconds,
      String visibility,
      String communityId) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "ProposalCreate")
  public record CreateProposal(String postId, String tripId, String quoteId) {}

  public record TripView(
      String id,
      String driverId,
      String status,
      String vehicleType,
      String originLabel,
      String destinationLabel,
      Instant departureAt,
      Instant arrivalAt,
      int offeredSeats,
      int remainingSeats,
      long contributionPerKm,
      String visibility,
      String communityId,
      long version,
      long termsVersion,
      long routeVersion) {}

  public record ProposalView(
      String id,
      String postId,
      String tripId,
      String senderId,
      String recipientId,
      String status,
      long priceVnd,
      Instant pickupAt,
      Instant dropoffAt,
      Instant expiresAt,
      long version) {}

  public record BookingView(
      String id,
      String tripId,
      String passengerId,
      String driverId,
      String status,
      long priceVnd,
      Instant pickupAt,
      Instant dropoffAt,
      String reason,
      long version) {}

  public record TripPage(List<TripView> items, String nextCursor) {}

  public record ProposalPage(List<ProposalView> items, String nextCursor) {}

  public record BookingPage(List<BookingView> items, String nextCursor) {}

  public TripView createTrip(String actor, CreateTrip input, String key) {
    driver(actor);
    validateTrip(input, actor);
    var vehicle =
        resources
            .vehicle(actor, input.vehicleId())
            .filter(v -> v.ownerId().equals(actor))
            .orElseThrow(() -> unavailable("VEHICLE_SOURCE_UNAVAILABLE"));
    var route =
        journeys
            .route(actor, input.routeId())
            .orElseThrow(() -> unavailable("ROUTING_SOURCE_UNAVAILABLE"));
    if (input.offeredSeats() < 1
        || route.durationSeconds() <= 0
        || !compatibleVehicleType(vehicle.type(), route.vehicleType())
        || input.offeredSeats() > vehicle.passengerCapacity()
        || !resources.contributionAllowed(vehicle, input.contributionPerKm()))
      throw invalid("INVALID_CAPACITY_OR_CONTRIBUTION");
    String id =
        commands.execute(
            actor,
            "trip.create",
            key,
            input.toString(),
            () -> {
              eligibility.fence(actor);
              driver(actor);
              resources.fenceVehicle(vehicle.id(), vehicle.approvalVersion());
              if (!clock.instant().isBefore(route.expiresAt())) throw conflict("ROUTE_EXPIRED");
              var t =
                  new Trip(
                      UUID.randomUUID().toString(),
                      actor,
                      vehicle.id(),
                      vehicle.type(),
                      vehicle.approvalVersion(),
                      Trip.Status.DRAFT,
                      input.offeredSeats(),
                      input.offeredSeats(),
                      route.id(),
                      0,
                      0,
                      input.departureAt(),
                      input.departureAt().plusSeconds(route.durationSeconds()),
                      route.originLabel(),
                      route.destinationLabel(),
                      input.visibility(),
                      input.communityId(),
                      input.contributionPerKm(),
                      input.detourMeters(),
                      input.detourSeconds(),
                      List.of(),
                      0);
              store.insertTrip(t);
              return t.id();
            });
    return trip(actor, id);
  }

  public TripView openTrip(String actor, String id, long version, String key) {
    driver(actor);
    commands.execute(
        actor,
        "trip.open",
        key,
        id + ":" + version,
        () -> {
          var t = ownedTrip(actor, id, version);
          eligibility.fence(actor);
          driver(actor);
          resources.fenceVehicle(t.vehicleId(), t.vehicleVersion());
          if (t.status() != Trip.Status.DRAFT || !clock.instant().isBefore(t.departureAt()))
            throw conflict("TRIP_CHANGED");
          var route =
              journeys
                  .route(actor, t.routeId())
                  .orElseThrow(() -> unavailable("ROUTING_SOURCE_UNAVAILABLE"));
          if (!clock.instant().isBefore(route.expiresAt())) throw conflict("ROUTE_EXPIRED");
          store.reserveInterval(
              actor, "trip:" + id, t.departureAt(), t.arrivalAt().plusSeconds(900), id);
          var next = t.status(Trip.Status.OPEN);
          store.saveTrip(t, next);
          event("trip.opened", id, next.version());
          return id;
        });
    return trip(actor, id);
  }

  @io.swagger.v3.oas.annotations.media.Schema(name = "TripEdit")
  public record EditTrip(long version, CreateTrip trip) {}

  public TripView editTrip(String actor, String id, EditTrip input, String key) {
    driver(actor);
    if (input.trip() == null) throw invalid("INVALID_TRIP");
    var edit = input.trip();
    validateTrip(edit, actor);
    var vehicle =
        resources
            .vehicle(actor, edit.vehicleId())
            .filter(v -> v.ownerId().equals(actor))
            .orElseThrow(() -> unavailable("VEHICLE_SOURCE_UNAVAILABLE"));
    var route =
        journeys
            .route(actor, edit.routeId())
            .orElseThrow(() -> unavailable("ROUTING_SOURCE_UNAVAILABLE"));
    if (!vehicle.type().equals(route.vehicleType())
        || route.durationSeconds() <= 0
        || edit.offeredSeats() < 1
        || edit.offeredSeats() > vehicle.passengerCapacity()
        || !resources.contributionAllowed(vehicle, edit.contributionPerKm()))
      throw invalid("INVALID_CAPACITY_OR_CONTRIBUTION");
    commands.execute(
        actor,
        "trip.edit",
        key,
        id + ":" + input,
        () -> {
          var before = ownedTrip(actor, id, input.version());
          eligibility.fence(actor);
          driver(actor);
          resources.fenceVehicle(vehicle.id(), vehicle.approvalVersion());
          if ((before.status() != Trip.Status.DRAFT && before.status() != Trip.Status.OPEN)
              || !store.tripBookings(id).isEmpty()
              || !clock.instant().isBefore(route.expiresAt()))
            throw conflict("TRIP_HAS_COMMITMENTS_OR_CHANGED");
          var next =
              new Trip(
                  id,
                  actor,
                  vehicle.id(),
                  vehicle.type(),
                  vehicle.approvalVersion(),
                  before.status(),
                  edit.offeredSeats(),
                  edit.offeredSeats(),
                  route.id(),
                  before.routeVersion() + 1,
                  before.termsVersion() + 1,
                  edit.departureAt(),
                  edit.departureAt().plusSeconds(route.durationSeconds()),
                  route.originLabel(),
                  route.destinationLabel(),
                  edit.visibility(),
                  edit.communityId(),
                  edit.contributionPerKm(),
                  edit.detourMeters(),
                  edit.detourSeconds(),
                  List.of(),
                  before.version() + 1);
          if (next.status() == Trip.Status.OPEN)
            store.reserveInterval(
                actor, "trip:" + id, next.departureAt(), next.arrivalAt().plusSeconds(900), id);
          store.saveTrip(before, next);
          posts.refreshTrip(id);
          for (var p : store.pendingTrip(id)) {
            var expired = p.transition(Proposal.Status.EXPIRED, "TERMS_CHANGED");
            store.saveProposal(p, expired);
            event("proposal.closed", p.id(), expired.version());
          }
          event("trip.changed", id, next.version());
          return id;
        });
    return trip(actor, id);
  }

  @io.swagger.v3.oas.annotations.media.Schema(name = "TripStops")
  public record Stops(List<RideResources.Stop> items, long routeVersion) {}

  public Stops stops(String actor, String id) {
    active(actor);
    var trip = store.trip(id).orElseThrow(RideService::missing);
    if (actor.equals(trip.driverId())) return new Stops(trip.stops(), trip.routeVersion());
    var owned =
        store.tripBookings(id).stream()
            .filter(b -> b.passengerId().equals(actor))
            .map(Booking::id)
            .collect(java.util.stream.Collectors.toSet());
    if (owned.isEmpty()) throw missing();
    return new Stops(
        trip.stops().stream().filter(s -> owned.contains(s.bookingId())).toList(),
        trip.routeVersion());
  }

  public TripView trip(String actor, String id) {
    active(actor);
    var t = store.trip(id).orElseThrow(RideService::missing);
    if (!actor.equals(t.driverId()) && (t.status() == Trip.Status.DRAFT || !canSee(actor, t)))
      throw missing();
    return tripView(t);
  }

  public TripPage trips(String actor, String cursor, int limit) {
    active(actor);
    page(cursor, limit);
    var rows = store.trips(actor, cursor, limit);
    return new TripPage(
        rows.stream().map(this::tripView).toList(),
        rows.size() == limit ? rows.getLast().id() : null);
  }

  public ProposalView propose(String actor, CreateProposal input, String key) {
    verified(actor);
    if (input.postId() == null || input.tripId() == null || input.quoteId() == null)
      throw invalid("INVALID_PROPOSAL");
    // Provider calls belong outside Mongo transaction; quote is immutable server evidence.
    var quote =
        resources
            .quote(actor, input.quoteId())
            .orElseThrow(() -> unavailable("QUOTE_SOURCE_UNAVAILABLE"));
    String id =
        commands.execute(
            actor,
            "proposal.create",
            key,
            input.toString(),
            () -> {
              var t = store.trip(input.tripId()).orElseThrow(RideService::missing);
              var post = posts.requireNeed(actor, input.postId());
              String passenger = post.ownerId();
              if (!actor.equals(passenger) && !actor.equals(t.driverId())) throw missing();
              if (passenger.equals(t.driverId())) throw invalid("SELF_RIDE");
              fenceParties(passenger, t.driverId());
              validateParties(passenger, t);
              commands.fence("intent", post.intentId());
              if (store.activeIntent(post.intentId())) throw conflict("BOOKING_ALREADY_EXISTS");
              validateQuote(quote, post, t, passenger);
              for (var p : store.pendingIntent(post.intentId()))
                if (!p.live(clock.instant()))
                  store.saveProposal(p, p.transition(Proposal.Status.EXPIRED, "TIME"));
              var pending = store.pendingIntent(post.intentId());
              var existing =
                  pending.stream()
                      .filter(p -> p.tripId().equals(t.id()) && p.live(clock.instant()))
                      .findFirst();
              if (existing.isPresent()) return existing.get().id();
              if (pending.size() >= 50) throw conflict("PENDING_LIMIT");
              boolean request = actor.equals(passenger);
              if (request) posts.requireOpenOffer(passenger, t.id());
              if (request
                  && pending.stream()
                      .anyMatch(
                          p ->
                              p.direction() == Proposal.Direction.PASSENGER_REQUEST
                                  && p.live(clock.instant())))
                throw conflict("PASSENGER_REQUEST_PENDING");
              Instant expires = clock.instant().plusSeconds(86400);
              if (t.departureAt().isBefore(expires)) expires = t.departureAt();
              if (quote.expiresAt().isBefore(expires)) expires = quote.expiresAt();
              var p =
                  new Proposal(
                      UUID.randomUUID().toString(),
                      post.id(),
                      post.intentId(),
                      t.id(),
                      passenger,
                      t.driverId(),
                      actor,
                      request ? t.driverId() : passenger,
                      request
                          ? Proposal.Direction.PASSENGER_REQUEST
                          : Proposal.Direction.DRIVER_OFFER,
                      Proposal.Status.PENDING,
                      null,
                      post.termsVersion(),
                      quote,
                      expires,
                      0);
              store.insertProposal(p);
              event("proposal.created", p.id(), p.version());
              return p.id();
            });
    return proposal(actor, id);
  }

  public ProposalView proposal(String actor, String id) {
    active(actor);
    var p =
        store
            .proposal(id)
            .filter(v -> participant(actor, v.passengerId(), v.driverId()))
            .orElseThrow(RideService::missing);
    return proposalView(p);
  }

  public ProposalPage proposals(String actor, String cursor, int limit) {
    active(actor);
    page(cursor, limit);
    var rows = store.proposals(actor, cursor, limit);
    return new ProposalPage(
        rows.stream().map(this::proposalView).toList(),
        rows.size() == limit ? rows.getLast().id() : null);
  }

  public ProposalView decide(String actor, String id, long version, boolean withdraw, String key) {
    active(actor);
    commands.execute(
        actor,
        withdraw ? "proposal.withdraw" : "proposal.reject",
        key,
        id + ":" + version,
        () -> {
          var p = store.proposal(id).orElseThrow(RideService::missing);
          if (!(withdraw ? p.senderId() : p.recipientId()).equals(actor)) throw missing();
          if (p.version() != version || !p.live(clock.instant()))
            throw conflict("PROPOSAL_EXPIRED_OR_CHANGED");
          var next =
              p.transition(withdraw ? Proposal.Status.WITHDRAWN : Proposal.Status.REJECTED, null);
          store.saveProposal(p, next);
          event("proposal.closed", id, next.version());
          return id;
        });
    return proposal(actor, id);
  }

  public BookingView accept(String actor, String id, long version, String key) {
    active(actor);
    String bookingId =
        commands.execute(
            actor,
            "proposal.accept",
            key,
            id + ":" + version,
            () -> {
              var p = store.proposal(id).orElseThrow(RideService::missing);
              if (!actor.equals(p.recipientId())) throw missing();
              var already = store.bookingForProposal(id);
              if (already.isPresent()) return already.get().id();
              if (p.version() != version || !p.live(clock.instant()))
                throw conflict("PROPOSAL_EXPIRED_OR_CHANGED");
              fenceParties(p.passengerId(), p.driverId());
              commands.fence("intent", p.intentId());
              var t = store.trip(p.tripId()).orElseThrow(RideService::missing);
              validateParties(p.passengerId(), t);
              var post = posts.requireNeed(p.driverId(), p.postId());
              if (p.direction() == Proposal.Direction.PASSENGER_REQUEST)
                posts.requireOpenOffer(p.passengerId(), t.id());
              if ("COMMUNITY".equals(post.visibility())) {
                communities.fence(p.passengerId(), post.communityId());
                communities.fence(p.driverId(), post.communityId());
              }
              if (post.termsVersion() != p.postTermsVersion()
                  || !post.intentId().equals(p.intentId())) throw conflict("TERMS_CHANGED");
              if (store.activeIntent(p.intentId())) throw conflict("BOOKING_ALREADY_EXISTS");
              validateQuote(p.quote(), post, t, p.passengerId());
              var quote = p.quote();
              String bid = UUID.randomUUID().toString();
              store.reserveInterval(
                  t.driverId(),
                  "trip:" + t.id(),
                  t.departureAt(),
                  max(
                          t.stops().stream()
                              .map(RideResources.Stop::eta)
                              .max(Instant::compareTo)
                              .orElse(t.arrivalAt()),
                          max(t.arrivalAt(), quote.dropoffAt()))
                      .plusSeconds(900),
                  t.id());
              store.reserveInterval(
                  p.passengerId(),
                  "booking:" + bid,
                  quote.pickupAt(),
                  quote.dropoffAt().plusSeconds(900),
                  null);
              validateStops(t, quote);
              var stops =
                  quote.stops().stream()
                      .map(
                          s ->
                              new RideResources.Stop(
                                  s.id(),
                                  s.bookingId() == null ? bid : s.bookingId(),
                                  s.kind(),
                                  s.publicLabel(),
                                  s.eta()))
                      .toList();
              var next = t.reserve(stops);
              store.saveTrip(t, next);
              var b =
                  new Booking(
                      bid,
                      id,
                      p.postId(),
                      p.intentId(),
                      t.id(),
                      p.passengerId(),
                      t.driverId(),
                      Booking.Status.CONFIRMED,
                      quote,
                      null,
                      false,
                      clock.instant(),
                      0);
              store.insertBooking(b);
              secrets.create(bid);
              posts.book(p.postId(), p.postTermsVersion());
              posts.reopenOffer(t.id(), next.remainingSeats() == 0);
              store.saveProposal(p, p.transition(Proposal.Status.ACCEPTED, null));
              for (var other : store.pendingIntent(p.intentId()))
                if (!other.id().equals(id))
                  store.saveProposal(
                      other, other.transition(Proposal.Status.EXPIRED, "INTENT_BOOKED"));
              event("booking.confirmed", bid, b.version());
              return bid;
            });
    return booking(actor, bookingId);
  }

  public BookingView booking(String actor, String id) {
    active(actor);
    return bookingView(participantBooking(actor, id));
  }

  public BookingPage bookings(String actor, String cursor, int limit) {
    active(actor);
    page(cursor, limit);
    var rows = store.bookings(actor, cursor, limit);
    return new BookingPage(
        rows.stream().map(this::bookingView).toList(),
        rows.size() == limit ? rows.getLast().id() : null);
  }

  public String code(String actor, String id) {
    active(actor);
    var b = participantBooking(actor, id);
    if (!actor.equals(b.passengerId()) || !b.active() || b.aboard()) throw missing();
    return secrets.reveal(id);
  }

  public record DraftAgain(String postId) {}

  public DraftAgain findAgain(String actor, String id, long version, String key) {
    verified(actor);
    return new DraftAgain(
        commands.execute(
            actor,
            "booking.find-again",
            key,
            id + ":" + version,
            () -> {
              var b = participantBooking(actor, id);
              if (!b.passengerId().equals(actor)) throw missing();
              if (b.version() != version
                  || !List.of(
                          Booking.Status.CANCELLED,
                          Booking.Status.NO_SHOW,
                          Booking.Status.ENDED_EARLY)
                      .contains(b.status())) throw conflict("BOOKING_CHANGED");
              commands.fence("intent", b.intentId());
              if (store.activeIntent(b.intentId())) throw conflict("BOOKING_ALREADY_EXISTS");
              return posts.draftAgain(actor, b.postId());
            }));
  }

  public BookingView bookingAction(
      String actor,
      String id,
      long version,
      Booking.Action action,
      String reason,
      String code,
      String key) {
    active(actor);
    if (action == null) throw invalid("INVALID_BOOKING_ACTION");
    var initial = participantBooking(actor, id);
    if (action == Booking.Action.BOARD) {
      if (!actor.equals(initial.driverId())) throw missing();
      if (initial.aboard()) return bookingView(initial);
      if (!initial.active()) throw conflict("BOOKING_CHANGED");
      if (!secrets.attempt(id, code)) throw invalid("BOARDING_CODE_INVALID");
    }
    commands.execute(
        actor,
        "booking." + action,
        key,
        id + ":" + version + ":" + reason,
        () -> {
          var b = participantBooking(actor, id);
          eligibility.fence(actor);
          active(actor);
          commands.fence("trip", b.tripId());
          if (b.version() != version) throw conflict("BOOKING_CHANGED");
          var t = store.trip(b.tripId()).orElseThrow(RideService::missing);
          Booking next;
          try {
            next =
                b.transition(
                    action, actor, t.status() == Trip.Status.IN_PROGRESS, reason, clock.instant());
          } catch (IllegalStateException invalid) {
            throw conflict(invalid.getMessage());
          }
          if (action == Booking.Action.BOARD) secrets.consume(id);
          if (!next.active()) {
            commands.fence("availability", b.passengerId());
            if (next.status() == Booking.Status.CANCELLED
                || next.status() == Booking.Status.NO_SHOW) store.releaseInterval("booking:" + id);
            if (!b.seatReleased()
                && (next.status() == Booking.Status.CANCELLED
                    || next.status() == Booking.Status.NO_SHOW)
                && (t.status() == Trip.Status.OPEN || t.status() == Trip.Status.FULL)
                && clock.instant().isBefore(t.departureAt())) {
              var released = t.release(b.id());
              store.saveTrip(t, released);
              posts.reopenOffer(t.id(), false);
              next = next.released();
            }
          }
          store.saveBooking(b, next);
          event("booking.changed", id, next.version());
          return id;
        });
    return booking(actor, id);
  }

  public TripView tripAction(
      String actor, String id, long version, String action, String reason, String key) {
    active(actor);
    if (action == null) throw invalid("INVALID_TRIP_ACTION");
    commands.execute(
        actor,
        "trip." + action,
        key,
        id + ":" + version + ":" + reason,
        () -> {
          commands.fence("trip", id);
          var t = ownedTrip(actor, id, version);
          var bookings = store.tripBookings(id);
          Trip next;
          switch (action) {
            case "start" -> {
              if (t.status() != Trip.Status.OPEN && t.status() != Trip.Status.FULL)
                throw conflict("TRIP_CHANGED");
              if (clock.instant().isBefore(t.departureAt().minusSeconds(900)))
                throw conflict("TOO_EARLY_TO_START");
              next = t.status(Trip.Status.IN_PROGRESS);
              for (var b : bookings)
                if (b.status() == Booking.Status.BOARDED)
                  store.saveBooking(b, b.start(clock.instant()));
            }
            case "complete" -> {
              if (t.status() != Trip.Status.IN_PROGRESS
                  || bookings.stream().anyMatch(Booking::active))
                throw conflict("BOOKINGS_NOT_TERMINAL");
              next = t.status(Trip.Status.COMPLETED);
            }
            case "cancel" -> {
              if (t.status() != Trip.Status.DRAFT
                  && t.status() != Trip.Status.OPEN
                  && t.status() != Trip.Status.FULL) throw conflict("USE_END_EARLY");
              if (reason == null || reason.isBlank() || reason.length() > 500)
                throw invalid("REASON_REQUIRED");
              if (bookings.stream().anyMatch(Booking::aboard)) throw conflict("USE_END_EARLY");
              for (var b : bookings)
                if (b.active()) {
                  commands.fence("availability", b.passengerId());
                  store.releaseInterval("booking:" + b.id());
                  var cancelled =
                      b.transition(Booking.Action.CANCEL, actor, false, reason, clock.instant())
                          .released();
                  store.saveBooking(b, cancelled);
                  event("booking.changed", b.id(), cancelled.version());
                }
              next = t.status(Trip.Status.CANCELLED);
            }
            default -> throw invalid("INVALID_TRIP_ACTION");
          }
          commands.fence("availability", actor);
          if (next.status() == Trip.Status.CANCELLED) store.releaseInterval("trip:" + id);
          store.saveTrip(t, next);
          posts.invalidateTrip(id);
          for (var p : store.pendingTrip(id))
            store.saveProposal(p, p.transition(Proposal.Status.EXPIRED, "TRIP_CLOSED"));
          event("trip.changed", id, next.version());
          return id;
        });
    return trip(actor, id);
  }

  private void validateParties(String passenger, Trip t) {
    verified(passenger);
    driver(t.driverId());
    resources.fenceVehicle(t.vehicleId(), t.vehicleVersion());
    if (social.blocked(passenger, t.driverId()) || !canSee(passenger, t)) throw missing();
    if ("COMMUNITY".equals(t.visibility())) {
      communities.fence(passenger, t.communityId());
      communities.fence(t.driverId(), t.communityId());
    }
    if (t.status() != Trip.Status.OPEN
        || t.remainingSeats() < 1
        || !clock.instant().isBefore(t.departureAt())) throw conflict("NO_SEATS_OR_TRIP_CLOSED");
  }

  private void fenceParties(String a, String b) {
    for (String user : java.util.stream.Stream.of(a, b).sorted().toList()) eligibility.fence(user);
    socialGuard.fence(a, b);
  }

  private void validateQuote(RideResources.Quote q, PostAccess.Terms p, Trip t, String passenger) {
    var intent =
        journeys
            .intent(passenger, p.intentId())
            .orElseThrow(() -> unavailable("JOURNEY_SOURCE_UNAVAILABLE"));
    if (!intent.ownerId().equals(passenger)
        || q.pickupAt().isBefore(intent.departureAt())
        || q.pickupAt().isAfter(intent.latestDepartureAt())
        || q.dropoffAt().isAfter(intent.arrivalAt())
        || !intent.routeId().equals(p.routeId())) throw conflict("INTENT_CHANGED");
    if (!q.intentId().equals(p.intentId())
        || !q.tripId().equals(t.id())
        || !q.passengerId().equals(passenger)
        || !q.driverId().equals(t.driverId())
        || q.tripTermsVersion() != t.termsVersion()
        || q.tripRouteVersion() != t.routeVersion()
        || !clock.instant().isBefore(q.expiresAt())
        || q.priceVnd() < 0
        || !q.dropoffAt().isAfter(q.pickupAt())
        || q.pickupAt().isBefore(t.departureAt())
        || q.originalDetourMeters() > t.detourMeters()
        || q.originalDetourSeconds() > t.detourSeconds())
      throw conflict("QUOTE_EXPIRED_OR_TERMS_CHANGED");
  }

  private void validateStops(Trip t, RideResources.Quote q) {
    var ids = q.stops().stream().map(RideResources.Stop::id).toList();
    if (new HashSet<>(ids).size() != ids.size()) throw conflict("INVALID_ROUTE_STOPS");
    int last = -1;
    for (var old : t.stops()) {
      int pos = ids.indexOf(old.id());
      if (pos <= last) throw conflict("COMMITTED_STOP_CHANGED");
      last = pos;
      var newer = q.stops().get(pos);
      if (!Objects.equals(old.bookingId(), newer.bookingId()) || newer.eta().isAfter(old.eta()))
        throw conflict("COMMITTED_STOP_CHANGED");
    }
    var added = q.stops().stream().filter(s -> s.bookingId() == null).toList();
    if (q.stops().size() != t.stops().size() + 2) throw conflict("INVALID_ROUTE_STOPS");
    Instant prior = t.departureAt();
    for (var stop : q.stops()) {
      if (stop.eta().isBefore(prior)) throw conflict("INVALID_ROUTE_STOPS");
      prior = stop.eta();
    }
    if (added.size() != 2
        || !added.get(0).kind().equals("PICKUP")
        || !added.get(1).kind().equals("DROPOFF")
        || !added.get(0).eta().equals(q.pickupAt())
        || !added.get(1).eta().equals(q.dropoffAt())) throw conflict("INVALID_ROUTE_STOPS");
  }

  private boolean canSee(String actor, Trip t) {
    return eligibility.active(t.driverId())
        && social.canRead(
            actor,
            t.driverId(),
            SocialAccessPolicy.Visibility.valueOf(t.visibility()),
            t.communityId() != null && communities.member(actor, t.communityId()));
  }

  private Booking participantBooking(String actor, String id) {
    return store
        .booking(id)
        .filter(b -> participant(actor, b.passengerId(), b.driverId()))
        .orElseThrow(RideService::missing);
  }

  private Trip ownedTrip(String actor, String id, long version) {
    var t =
        store.trip(id).filter(v -> v.driverId().equals(actor)).orElseThrow(RideService::missing);
    if (t.version() != version) throw conflict("TRIP_CHANGED");
    return t;
  }

  private boolean participant(String actor, String a, String b) {
    return actor.equals(a) || actor.equals(b);
  }

  private TripView tripView(Trip t) {
    return new TripView(
        t.id(),
        t.driverId(),
        t.status().name(),
        t.vehicleType(),
        t.originLabel(),
        t.destinationLabel(),
        t.departureAt(),
        t.arrivalAt(),
        t.offeredSeats(),
        t.remainingSeats(),
        t.contributionPerKm(),
        t.visibility(),
        t.communityId(),
        t.version(),
        t.termsVersion(),
        t.routeVersion());
  }

  private ProposalView proposalView(Proposal p) {
    return new ProposalView(
        p.id(),
        p.postId(),
        p.tripId(),
        p.senderId(),
        p.recipientId(),
        p.status() == Proposal.Status.PENDING && !p.live(clock.instant())
            ? "EXPIRED"
            : p.status().name(),
        p.quote().priceVnd(),
        p.quote().pickupAt(),
        p.quote().dropoffAt(),
        p.expiresAt(),
        p.version());
  }

  private BookingView bookingView(Booking b) {
    return new BookingView(
        b.id(),
        b.tripId(),
        b.passengerId(),
        b.driverId(),
        b.status().name(),
        b.agreedTerms().priceVnd(),
        b.agreedTerms().pickupAt(),
        b.agreedTerms().dropoffAt(),
        b.reason(),
        b.version());
  }

  private void validateTrip(CreateTrip i, String actor) {
    if (i.departureAt() == null
        || !i.departureAt().isAfter(clock.instant())
        || i.originLabel() == null
        || i.destinationLabel() == null
        || i.originLabel().length() > 120
        || i.destinationLabel().length() > 120
        || i.originLabel().isBlank()
        || i.destinationLabel().isBlank()
        || i.vehicleId() == null
        || i.routeId() == null
        || i.contributionPerKm() < 0
        || i.detourMeters() < 0
        || i.detourSeconds() < 0
        || i.visibility() == null
        || !List.of("PUBLIC", "FRIENDS", "COMMUNITY").contains(i.visibility()))
      throw invalid("INVALID_TRIP");
    if (i.visibility().equals("COMMUNITY")
        && (i.communityId() == null || !communities.member(actor, i.communityId())))
      throw invalid("MEMBERSHIP_REQUIRED");
  }

  private void active(String actor) {
    if (!eligibility.active(actor))
      throw new ApiException(
          HttpStatus.FORBIDDEN, "ACCOUNT_UNAVAILABLE", "Tài khoản không khả dụng");
  }

  private void verified(String actor) {
    active(actor);
    if (!eligibility.verified(actor))
      throw new ApiException(
          HttpStatus.FORBIDDEN, "VERIFICATION_REQUIRED", "Cần xác minh tài khoản");
  }

  private void driver(String actor) {
    active(actor);
    if (!eligibility.driver(actor))
      throw new ApiException(
          HttpStatus.FORBIDDEN, "DRIVER_APPROVAL_REQUIRED", "Cần được duyệt tài xế");
  }

  private void page(String cursor, int limit) {
    if (limit < 1 || limit > 50 || (cursor != null && !cursor.matches("[A-Za-z0-9-]{1,100}")))
      throw invalid("INVALID_PAGE");
  }

  private void event(String type, String id, long version) {
    outbox.publish(type, "Ride", id, 1, Map.of("resourceId", id, "version", version));
  }

  private Instant max(Instant a, Instant b) {
    return a.isAfter(b) ? a : b;
  }

  private boolean compatibleVehicleType(String vehicleType, String routeType) {
    return vehicleType.equals(routeType)
        || (vehicleType.equals("MOTORCYCLE") && routeType.equals("MOTORBIKE"));
  }

  private static ApiException missing() {
    return new ApiException(
        HttpStatus.NOT_FOUND, "RESOURCE_NOT_AVAILABLE", "Không tìm thấy dữ liệu");
  }

  private static ApiException conflict(String code) {
    return new ApiException(
        HttpStatus.CONFLICT, code, "Trạng thái hoặc điều kiện đã thay đổi, vui lòng tải lại");
  }

  private static ApiException invalid(String code) {
    return new ApiException(HttpStatus.BAD_REQUEST, code, "Dữ liệu không hợp lệ");
  }

  private static ApiException unavailable(String code) {
    return new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        code,
        "Chức năng đang chờ dữ liệu đã xác thực từ dịch vụ liên quan");
  }
}
