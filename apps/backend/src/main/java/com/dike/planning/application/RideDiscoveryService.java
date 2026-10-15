package com.dike.planning.application;

import com.dike.planning.PostAccounts;
import com.dike.planning.domain.*;
import com.dike.shared.api.ApiException;
import java.time.*;
import java.util.*;
import org.bson.Document;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/** Broad discovery using saved geometry, without requesting new provider directions. */
@Service
public class RideDiscoveryService {
  private final PlanningStore routes;
  private final PostStore store;
  private final PostService posts;
  private final PostAccounts accounts;
  private final MongoTemplate mongo;
  private final Clock clock;

  public RideDiscoveryService(
      PlanningStore routes,
      PostStore store,
      PostService posts,
      PostAccounts accounts,
      MongoTemplate mongo,
      Clock clock) {
    this.routes = routes;
    this.store = store;
    this.posts = posts;
    this.accounts = accounts;
    this.mongo = mongo;
    this.clock = clock;
  }

  @io.swagger.v3.oas.annotations.media.Schema(name = "RideDiscoveryInput")
  public record Input(String routeId, String role, Instant departureAt, int seats) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "RideDiscoveryMatch")
  public record Match(
      PostService.View post,
      long pickupDistanceMeters,
      long destinationDistanceMeters,
      long timeDifferenceMinutes) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "RideDiscoveryResults")
  public record Results(List<Match> items) {}

  public Results search(String actor, Input input) {
    if (!accounts.active(actor))
      throw new ApiException(HttpStatus.FORBIDDEN, "ACCOUNT_INACTIVE", "Account inactive");
    if (input.routeId() == null
        || !List.of("driver", "passenger").contains(Objects.toString(input.role(), ""))
        || input.departureAt() == null
        || input.seats() < 1
        || input.seats() > 8
        || input.departureAt().isBefore(clock.instant().minusSeconds(3600))
        || input.departureAt().isAfter(clock.instant().plusSeconds(7 * 86400)))
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "INVALID_DISCOVERY", "Invalid discovery parameters");
    var own =
        routes
            .route(input.routeId())
            .filter(r -> actor.equals(r.ownerUserId()))
            .orElseThrow(
                () -> new ApiException(HttpStatus.NOT_FOUND, "ROUTE_NOT_FOUND", "Route not found"));
    if (!own.expiresAt().isAfter(clock.instant()))
      throw new ApiException(
          HttpStatus.CONFLICT, "ROUTE_EXPIRED", "Please calculate the route again");
    boolean driver = input.role().equals("driver");
    var type = driver ? RidePost.Type.NEED_RIDE : RidePost.Type.OFFER_RIDE;
    var query =
        Query.query(
                Criteria.where("status")
                    .is("OPEN")
                    .and("type")
                    .is(type.name())
                    .and("ownerId")
                    .ne(actor)
                    .and("expiresAt")
                    .gt(clock.instant())
                    .and("departureAt")
                    .gte(input.departureAt().minusSeconds(3600))
                    .lte(input.departureAt().plusSeconds(3600)))
            .with(Sort.by("departureAt").ascending().and(Sort.by("_id").ascending()))
            .limit(500);
    var matches = new ArrayList<Match>();
    for (var row : mongo.find(query, Document.class, "ride_posts")) {
      var candidate = store.find(row.getString("_id")).orElse(null);
      if (candidate == null
          || actor.equals(candidate.ownerId())
          || candidate.type() != type
          || !candidate.live(clock.instant())
          || !posts.readable(actor, candidate)
          || Math.abs(Duration.between(input.departureAt(), candidate.departureAt()).toSeconds())
              > 3600
          || candidate.routeId() == null) continue;
      var saved =
          routes
              .route(candidate.routeId())
              .filter(r -> candidate.ownerId().equals(r.ownerUserId()))
              .orElse(null);
      if (saved == null || own.vehicleMode() != saved.vehicleMode()) continue;
      var driverRoute = driver ? own : saved;
      var passengerRoute = driver ? saved : own;
      var start = nearest(passengerRoute.geometry().getFirst(), driverRoute.geometry());
      var end = nearest(passengerRoute.geometry().getLast(), driverRoute.geometry());
      if (start.meters() > 5000 || end.meters() > 5000 || start.position() >= end.position())
        continue;
      var view = posts.detail(actor, candidate.id());
      if (!"OPEN".equals(view.status())
          || (!driver && (view.remainingSeats() == null || view.remainingSeats() < input.seats())))
        continue;
      matches.add(
          new Match(
              view,
              Math.round(start.meters()),
              Math.round(end.meters()),
              Duration.between(input.departureAt(), candidate.departureAt()).toMinutes()));
    }
    matches.sort(
        Comparator.comparingLong(
                (Match m) -> m.pickupDistanceMeters() + m.destinationDistanceMeters())
            .thenComparingLong(m -> Math.abs(m.timeDifferenceMinutes()))
            .thenComparing(m -> m.post().id()));
    return new Results(matches.stream().limit(20).toList());
  }

  record Projection(double meters, double position) {}

  // Project onto every segment, preserving travel order along the actual saved polyline.
  static Projection nearest(RoutePoint point, List<RoutePoint> line) {
    double best = Double.POSITIVE_INFINITY, position = 0;
    double scaleX = 111320 * Math.cos(Math.toRadians(point.latitude()));
    for (int i = 0; i < line.size() - 1; i++) {
      var a = line.get(i);
      var b = line.get(i + 1);
      double ax = (a.longitude() - point.longitude()) * scaleX;
      double ay = (a.latitude() - point.latitude()) * 111320;
      double dx = (b.longitude() - a.longitude()) * scaleX;
      double dy = (b.latitude() - a.latitude()) * 111320;
      double length = dx * dx + dy * dy;
      double t = length == 0 ? 0 : Math.clamp(-(ax * dx + ay * dy) / length, 0, 1);
      double meters = Math.hypot(ax + t * dx, ay + t * dy);
      if (meters < best) {
        best = meters;
        position = i + t;
      }
    }
    return new Projection(best, position);
  }
}
