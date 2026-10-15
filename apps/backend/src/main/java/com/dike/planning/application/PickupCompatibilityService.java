package com.dike.planning.application;

import com.dike.planning.domain.*;
import com.dike.planning.infrastructure.routing.RoutingProperties;
import com.dike.shared.api.ApiException;
import java.time.*;
import java.util.*;
import org.bson.Document;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/** Server-owned evidence for a passenger's pickup and drop-off along a driver's trip. */
@Service
public class PickupCompatibilityService {
  private final PostService posts;
  private final PostRouteService routes;
  private final ResolvedPlaceStore places;
  private final RoutingProvider provider;
  private final RouteCache cache;
  private final RoutingProperties config;
  private final MongoTemplate mongo;
  private final Clock clock;

  public PickupCompatibilityService(
      PostService posts,
      PostRouteService routes,
      ResolvedPlaceStore places,
      RoutingProvider provider,
      RouteCache cache,
      RoutingProperties config,
      MongoTemplate mongo,
      Clock clock) {
    this.posts = posts;
    this.routes = routes;
    this.places = places;
    this.provider = provider;
    this.cache = cache;
    this.config = config;
    this.mongo = mongo;
    this.clock = clock;
  }

  @io.swagger.v3.oas.annotations.media.Schema(name = "PickupCheckInput")
  public record Input(
      String pickupPlaceRef,
      Instant readyAt,
      Instant latestPickupAt,
      String passengerRouteId,
      String dropoffPlaceRef,
      Boolean useDriverPickup,
      Boolean useDriverDropoff) {
    public Input {
      useDriverPickup = Boolean.TRUE.equals(useDriverPickup);
      useDriverDropoff = Boolean.TRUE.equals(useDriverDropoff);
    }

    public Input(
        String pickupPlaceRef, Instant readyAt, Instant latestPickupAt, String passengerRouteId) {
      this(pickupPlaceRef, readyAt, latestPickupAt, passengerRouteId, null, false, false);
    }

    public Input(String pickupPlaceRef, Instant readyAt, Instant latestPickupAt) {
      this(pickupPlaceRef, readyAt, latestPickupAt, null);
    }
  }

  @io.swagger.v3.oas.annotations.media.Schema(name = "PickupCheck")
  public record View(
      @Id String id,
      String postId,
      String passengerId,
      String tripId,
      long postVersion,
      long tripVersion,
      long tripRouteVersion,
      String routeId,
      PlaceSnapshot pickup,
      String destinationLabel,
      Instant readyAt,
      Instant latestPickupAt,
      Instant pickupAt,
      Instant arrivalAt,
      long extraMeters,
      long extraSeconds,
      long maxExtraMeters,
      long maxExtraSeconds,
      boolean compatible,
      String reason,
      List<RoutePoint> geometry,
      int pickupIndex,
      String provider,
      Instant expiresAt,
      PlaceSnapshot dropoff,
      int dropoffIndex,
      String driverDestinationLabel) {}

  public View check(String actor, String postId, Input input) {
    var post = posts.detail(actor, postId);
    Document trip = available(post, actor);
    Instant now = clock.instant();
    Instant departure = trip.getDate("departureAt").toInstant();
    if (input != null && input.readyAt() == null && input.latestPickupAt() == null) {
      input =
          new Input(
              input.pickupPlaceRef(),
              departure,
              departure.plus(Duration.ofHours(4)),
              input.passengerRouteId(),
              input.dropoffPlaceRef(),
              input.useDriverPickup(),
              input.useDriverDropoff());
    }
    if (input == null
        || (input.pickupPlaceRef() != null
            && !input.pickupPlaceRef().matches("[A-Za-z0-9_-]{8,100}"))
        || (input.dropoffPlaceRef() != null
            && !input.dropoffPlaceRef().matches("[A-Za-z0-9_-]{8,100}"))
        || input.readyAt() == null
        || input.latestPickupAt() == null
        || input.latestPickupAt().isBefore(input.readyAt())
        || input.latestPickupAt().isBefore(now)
        || input.latestPickupAt().isAfter(now.plus(Duration.ofDays(8)))
        || Duration.between(input.readyAt(), input.latestPickupAt()).compareTo(Duration.ofHours(4))
            > 0)
      throw error(
          HttpStatus.BAD_REQUEST,
          "INVALID_PICKUP",
          "Chọn điểm đón và khoảng thời gian đón hợp lệ (tối đa 4 giờ).");
    var ownRoute =
        input.passengerRouteId() == null
            ? null
            : routes.ownedSnapshot(actor, input.passengerRouteId());
    if (ownRoute != null && !ownRoute.expiresAt().isAfter(now))
      throw error(
          HttpStatus.CONFLICT,
          "ROUTE_EXPIRED",
          "Tuyến đường của bạn đã hết hạn. Vui lòng tính lại.");
    var base = routes.snapshot(actor, postId);
    if (ownRoute != null && ownRoute.vehicleMode() != base.vehicleMode())
      throw error(
          HttpStatus.BAD_REQUEST,
          "VEHICLE_MISMATCH",
          "Phương tiện của hai hành trình không phù hợp.");
    var pickup =
        input.pickupPlaceRef() != null
            ? resolved(actor, input.pickupPlaceRef())
            : ownRoute != null && !input.useDriverPickup() ? ownRoute.origin() : base.origin();
    var dropoff =
        input.dropoffPlaceRef() != null
            ? resolved(actor, input.dropoffPlaceRef())
            : ownRoute != null && !input.useDriverDropoff()
                ? ownRoute.destination()
                : base.destination();
    long meters;
    long seconds;
    Instant eta;
    List<RoutePoint> geometry;
    int pickupIndex;
    int dropoffIndex;
    long passengerSeconds;
    try {
      if (near(pickup, dropoff))
        throw error(
            HttpStatus.BAD_REQUEST,
            "PICKUP_AT_DESTINATION",
            "Điểm đón đang trùng điểm đến. Hãy chọn điểm xuất phát của bạn.");
      if (near(pickup, base.origin()) && near(dropoff, base.destination())) {
        eta = departure;
        meters = base.distanceMeters();
        seconds = base.durationSeconds();
        geometry = base.geometry();
        pickupIndex = 0;
        dropoffIndex = geometry.size() - 1;
        passengerSeconds = seconds;
      } else {
        var first =
            near(pickup, base.origin()) ? null : leg(base.origin(), pickup, base.vehicleMode());
        var shared = leg(pickup, dropoff, base.vehicleMode());
        var tail =
            near(dropoff, base.destination())
                ? null
                : leg(dropoff, base.destination(), base.vehicleMode());
        long approachSeconds = first == null ? 0 : first.durationSeconds();
        eta = departure.plusSeconds(approachSeconds);
        passengerSeconds = approachSeconds + shared.durationSeconds();
        meters =
            (first == null ? 0 : first.distanceMeters())
                + shared.distanceMeters()
                + (tail == null ? 0 : tail.distanceMeters());
        seconds = passengerSeconds + (tail == null ? 0 : tail.durationSeconds());
        var points =
            new ArrayList<>(
                first == null
                    ? List.of(new RoutePoint(pickup.longitude(), pickup.latitude()))
                    : first.geometry());
        pickupIndex = points.size() - 1;
        points.addAll(shared.geometry());
        dropoffIndex = points.size() - 1;
        if (tail != null) points.addAll(tail.geometry());
        geometry = List.copyOf(points);
      }
    } catch (RoutingProviderException e) {
      throw error(
          HttpStatus.SERVICE_UNAVAILABLE,
          e.code(),
          "Chưa kiểm tra được tuyến đường, vui lòng thử lại.");
    }
    long wait = Math.max(0, Duration.between(eta, input.readyAt()).getSeconds());
    seconds += wait;
    passengerSeconds += wait;
    Instant pickupAt = eta.isBefore(input.readyAt()) ? input.readyAt() : eta;
    long extraMeters = Math.max(0, meters - base.distanceMeters());
    long extraSeconds = Math.max(0, seconds - base.durationSeconds());
    long maxMeters = number(trip, "detourMeters");
    long maxSeconds = number(trip, "detourSeconds");
    String reason =
        pickupAt.isAfter(input.latestPickupAt())
            ? "PICKUP_TOO_LATE"
            : extraMeters > maxMeters || extraSeconds > maxSeconds
                ? "DETOUR_EXCEEDED"
                : "COMPATIBLE";
    var result =
        new View(
            UUID.randomUUID().toString(),
            postId,
            actor,
            post.type().equals("OFFER_RIDE") ? trip.getString("_id") : "",
            post.version(),
            number(trip, "version"),
            number(trip, "routeVersion"),
            base.id(),
            pickup,
            dropoff.displayLabel(),
            input.readyAt(),
            input.latestPickupAt(),
            pickupAt,
            departure.plusSeconds(passengerSeconds),
            extraMeters,
            extraSeconds,
            maxMeters,
            maxSeconds,
            reason.equals("COMPATIBLE"),
            reason,
            geometry,
            pickupIndex,
            base.provider(),
            now.plus(Duration.ofMinutes(5)),
            dropoff,
            dropoffIndex,
            base.destination().displayLabel());
    return mongo.insert(result, "pickup_checks");
  }

  public View require(String actor, String postId, String checkId) {
    if (checkId == null || checkId.isBlank()) {
      // No custom addresses means the passenger joins at the driver's existing endpoints.
      available(posts.detail(actor, postId), actor);
      return null;
    }
    View check = mongo.findById(checkId, View.class, "pickup_checks");
    if (check == null || !actor.equals(check.passengerId()) || !postId.equals(check.postId()))
      throw error(
          HttpStatus.NOT_FOUND, "PICKUP_CHECK_NOT_FOUND", "Không tìm thấy kết quả kiểm tra.");
    var post = posts.detail(actor, postId);
    var trip = available(post, actor);
    if (!check.compatible()
        || !check.expiresAt().isAfter(clock.instant())
        || check.postVersion() != post.version()
        || check.tripVersion() != number(trip, "version")
        || check.tripRouteVersion() != number(trip, "routeVersion")
        || !check.routeId().equals(routes.snapshot(actor, postId).id())
        || !check.tripId().equals(trip.getString("_id"))
        || check.pickupAt().isBefore(clock.instant()))
      throw error(
          HttpStatus.CONFLICT,
          "PICKUP_CHECK_CHANGED",
          "Chuyến hoặc thời gian đón đã thay đổi. Người đi ké cần kiểm tra lại và gửi yêu cầu mới.");
    return check;
  }

  private Document available(PostService.View post, String actor) {
    if (!post.type().equals("OFFER_RIDE")
        || !post.status().equals("OPEN")
        || post.ownerId().equals(actor))
      throw error(HttpStatus.CONFLICT, "TRIP_NOT_AVAILABLE", "Chuyến không còn nhận người đi ké.");
    // Post IDs are not trip IDs; resolve the source on the server.
    var source = mongo.findById(post.id(), Document.class, "ride_posts");
    var trip =
        source == null
            ? null
            : mongo.findById(source.getString("sourceId"), Document.class, "trips");
    if (trip == null
        || !post.ownerId().equals(trip.getString("driverId"))
        || !"OPEN".equals(trip.getString("status"))
        || number(trip, "remainingSeats") < 1
        || !trip.getDate("departureAt").toInstant().isAfter(clock.instant()))
      throw error(
          HttpStatus.CONFLICT, "TRIP_NOT_AVAILABLE", "Chuyến đã hết chỗ hoặc đã khởi hành.");
    if (trip.get("stops") instanceof List<?> stops && !stops.isEmpty())
      throw error(
          HttpStatus.CONFLICT,
          "PICKUP_MULTIPLE_STOPS_UNSUPPORTED",
          "Chuyến đã có điểm đón khác; chưa hỗ trợ tính thêm điểm đón cho chuyến này.");
    return trip;
  }

  private PlaceSnapshot resolved(String actor, String reference) {
    return places
        .find(actor, reference)
        .orElseThrow(
            () ->
                error(
                    HttpStatus.BAD_REQUEST,
                    "PICKUP_EXPIRED",
                    "Địa điểm đã hết hạn, vui lòng chọn lại địa chỉ."));
  }

  private RoutingProvider.RouteResult leg(PlaceSnapshot from, PlaceSnapshot to, VehicleMode mode) {
    try {
      var found = cache.find(from, to, mode);
      if (found.isPresent()) return found.get();
    } catch (RuntimeException ignored) {
    }
    var result = provider.route(from, to, mode);
    try {
      cache.put(from, to, mode, result, config.cacheTtl());
    } catch (RuntimeException ignored) {
    }
    return result;
  }

  private static boolean near(PlaceSnapshot a, PlaceSnapshot b) {
    double lat = Math.toRadians(a.latitude() - b.latitude());
    double lng = Math.toRadians(a.longitude() - b.longitude());
    double h =
        Math.pow(Math.sin(lat / 2), 2)
            + Math.cos(Math.toRadians(a.latitude()))
                * Math.cos(Math.toRadians(b.latitude()))
                * Math.pow(Math.sin(lng / 2), 2);
    return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(h))) <= 15;
  }

  private static long number(Document doc, String field) {
    return doc.get(field) instanceof Number n ? n.longValue() : 0;
  }

  private static ApiException error(HttpStatus status, String code, String message) {
    return new ApiException(status, code, message);
  }
}
