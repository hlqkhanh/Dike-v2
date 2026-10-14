package com.dike.planning.infrastructure.mongo;

import com.dike.planning.application.*;
import com.dike.planning.domain.*;
import com.dike.planning.infrastructure.routing.RoutingProperties;
import com.dike.shared.api.ApiException;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;
import org.bson.Document;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/** Durable preview snapshots and a cross-instance lease prevent duplicate provider calls. */
@Component
public class MongoPostRouteRecovery implements PostRouteRecovery {
  private final MongoTemplate mongo;
  private final PlanningStore routes;
  private final RoutingProvider provider;
  private final RouteCache cache;
  private final RoutingProperties config;
  private final Clock clock;

  public MongoPostRouteRecovery(
      MongoTemplate mongo,
      PlanningStore routes,
      RoutingProvider provider,
      RouteCache cache,
      RoutingProperties config,
      Clock clock) {
    this.mongo = mongo;
    this.routes = routes;
    this.provider = provider;
    this.cache = cache;
    this.config = config;
    this.clock = clock;
  }

  @Override
  public RouteSnapshot recover(RidePost post) {
    String fingerprint =
        post.id()
            + "\n"
            + post.sourceVersion()
            + "\n"
            + post.originLabel()
            + "\n"
            + post.destinationLabel()
            + "\n"
            + post.vehicleType();
    String id =
        "post-route-" + UUID.nameUUIDFromBytes(fingerprint.getBytes(StandardCharsets.UTF_8));
    var saved = routes.route(id);
    if (saved.isPresent()) return owned(post, saved.get());
    String token = UUID.randomUUID().toString();
    var now = clock.instant();
    try {
      var lease =
          mongo.findAndModify(
              Query.query(Criteria.where("_id").is(id).and("until").lte(Date.from(now))),
              new Update()
                  .set("token", token)
                  .set("until", Date.from(now.plus(Duration.ofMinutes(2)))),
              FindAndModifyOptions.options().upsert(true).returnNew(true),
              Document.class,
              "post_route_leases");
      if (lease == null) throw busy();
    } catch (DuplicateKeyException e) {
      throw busy();
    }
    try {
      saved = routes.route(id);
      if (saved.isPresent()) return owned(post, saved.get());
      var document = mongo.findById(post.id(), Document.class, "ride_posts");
      PlaceSnapshot origin = place(post, document, "origin", post.originLabel());
      PlaceSnapshot destination = place(post, document, "destination", post.destinationLabel());
      VehicleMode mode = "CAR".equals(post.vehicleType()) ? VehicleMode.CAR : VehicleMode.MOTORBIKE;
      Optional<RoutingProvider.RouteResult> cached;
      try {
        cached = cache.find(origin, destination, mode);
      } catch (RuntimeException ignored) {
        cached = Optional.empty();
      }
      var result = cached.orElseGet(() -> provider.route(origin, destination, mode));
      if (cached.isEmpty()) {
        try {
          cache.put(origin, destination, mode, result, config.cacheTtl());
        } catch (RuntimeException ignored) {
          /* Cache is optional; the durable snapshot is authoritative. */
        }
      }
      return routes.insertRoute(
          new RouteSnapshot(
              id,
              post.ownerId(),
              result.provider(),
              result.providerRouteId(),
              mode,
              origin,
              destination,
              result.distanceMeters(),
              result.durationSeconds(),
              result.geometry(),
              now,
              now.plus(config.estimateTtl()),
              0));
    } catch (RoutingProviderException e) {
      throw new ApiException(
          HttpStatus.SERVICE_UNAVAILABLE,
          e.code(),
          "Chưa tính được tuyến đường, vui lòng thử lại.");
    } finally {
      mongo.remove(
          Query.query(Criteria.where("_id").is(id).and("token").is(token)), "post_route_leases");
    }
  }

  private PlaceSnapshot place(RidePost post, Document document, String field, String label) {
    Document point = document == null ? null : document.get(field, Document.class);
    if (point == null) {
      // Legacy posts can still use precise coordinates from their owner's saved intent.
      var intent =
          mongo.findOne(
              Query.query(
                  Criteria.where("ownerUserId")
                      .is(post.ownerId())
                      .and(field + ".displayLabel")
                      .is(label)),
              Document.class,
              "travel_intents");
      if (intent != null) point = intent.get(field, Document.class);
    }
    if (point != null
        && point.get("longitude") instanceof Number lng
        && point.get("latitude") instanceof Number lat) {
      return new PlaceSnapshot(
          "SAVED",
          post.id() + ":" + field,
          label,
          label,
          lng.doubleValue(),
          lat.doubleValue(),
          clock.instant());
    }
    // Older posts containing only an address must resolve it before requesting directions.
    String address =
        label.contains("·") ? label.substring(label.lastIndexOf('·') + 1).trim() : label;
    String session = UUID.randomUUID().toString();
    var places = provider.autocomplete(address, session, null, null);
    if (places.isEmpty())
      throw new ApiException(
          HttpStatus.NOT_FOUND, "POST_ROUTE_NOT_FOUND", "Không tìm thấy tọa độ của bài đăng.");
    return provider.resolve(places.getFirst().providerPlaceId(), session, clock.instant());
  }

  private RouteSnapshot owned(RidePost post, RouteSnapshot route) {
    if (!post.ownerId().equals(route.ownerUserId()))
      throw new ApiException(HttpStatus.NOT_FOUND, "POST_ROUTE_NOT_FOUND", "Saved route not found");
    return route;
  }

  private static ApiException busy() {
    return new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        "POST_ROUTE_CALCULATING",
        "Tuyến đường đang được tính, vui lòng thử lại sau vài giây.",
        Duration.ofSeconds(3));
  }
}
