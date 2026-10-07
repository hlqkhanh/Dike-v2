package com.dike.ride;

import com.dike.identity.IdentityAccess;
import com.dike.messaging.RealtimeEnvelope;
import com.dike.messaging.RealtimePublisher;
import com.dike.ride.application.RideService;
import com.dike.shared.api.ApiException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AvailabilityService {

  private static final Duration AVAILABILITY_TTL = Duration.ofSeconds(60);
  private static final Duration SEARCHABLE_AGE = Duration.ofSeconds(45);
  private static final Duration LOCATION_TTL = Duration.ofSeconds(120);
  private static final Duration LOCATION_STALE = Duration.ofSeconds(45);
  private final StringRedisTemplate redis;
  private final MongoTemplate mongo;
  private final RideParticipantAccess rides;
  private final RideService rideService;
  private final IdentityAccess identities;
  private final RealtimePublisher realtime;
  private final Clock clock;
  private final String environment;

  public AvailabilityService(
      StringRedisTemplate redis,
      MongoTemplate mongo,
      RideParticipantAccess rides,
      RideService rideService,
      IdentityAccess identities,
      RealtimePublisher realtime,
      Clock clock,
      org.springframework.core.env.Environment environment) {
    this.redis = redis;
    this.mongo = mongo;
    this.rides = rides;
    this.rideService = rideService;
    this.identities = identities;
    this.realtime = realtime;
    this.clock = clock;
    this.environment = environment.getProperty("dike.environment", "local");
  }

  public record AvailabilityView(
      String handle,
      String tripId,
      Instant enabledAt,
      Instant lastHeartbeatAt,
      Instant expiresAt,
      AreaCenter areaCenter,
      int accuracyRadiusMeters,
      boolean stale,
      boolean liveTrackingAvailable) {}

  public record AreaCenter(double latitude, double longitude) {}

  public record Candidate(
      String handle,
      String tripId,
      AreaCenter areaCenter,
      int accuracyRadiusMeters,
      Instant updatedAt,
      boolean stale,
      boolean liveTrackingAvailable) {}

  public record LocationView(
      String userId,
      double latitude,
      double longitude,
      double accuracyMeters,
      String source,
      Instant updatedAt,
      boolean stale) {}

  public record LiveLocationView(List<LocationView> locations) {}

  public AvailabilityView enable(
      String actor, String tripId, Double latitude, Double longitude, Double accuracyMeters) {
    var identity = identities.require(actor);
    if (!identity.approvedDriver()) throw forbidden("AVAILABILITY_NOT_ELIGIBLE");
    var trip = rides.trip(tripId).orElseThrow(AvailabilityService::missing);
    Instant now = clock.instant();
    if (!actor.equals(trip.driverId())
        || !"OPEN".equals(trip.status())
        || trip.remainingSeats() < 1
        || trip.departureAt().isBefore(now)
        || trip.departureAt().isAfter(now.plus(Duration.ofMinutes(15)))) {
      throw forbidden("AVAILABILITY_NOT_ELIGIBLE");
    }
    validateCoordinates(latitude, longitude, accuracyMeters, false);
    String existing = redis.opsForValue().get(userKey(actor));
    if (existing != null) throw conflict("AVAILABILITY_ALREADY_ACTIVE");
    String handle = UUID.randomUUID().toString();
    Instant expires = now.plus(AVAILABILITY_TTL);
    Map<String, String> fields =
        new java.util.HashMap<>(
            Map.of(
                "handle", handle,
                "driverId", actor,
                "tripId", tripId,
                "tripVersion", Long.toString(trip.version()),
                "enabledAt", now.toString(),
                "heartbeatAt", now.toString(),
                "expiresAt", expires.toString()));
    if (latitude != null) {
      fields.put("latitude", latitude.toString());
      fields.put("longitude", longitude.toString());
      fields.put("accuracy", accuracyMeters.toString());
      fields.put("locationAt", now.toString());
    }
    redis.opsForHash().putAll(handleKey(handle), fields);
    redis.expire(handleKey(handle), AVAILABILITY_TTL);
    redis.opsForValue().set(userKey(actor), handle, AVAILABILITY_TTL);
    redis.opsForSet().add(indexKey(), handle);
    return availability(fields, now);
  }

  public AvailabilityView mine(String actor) {
    String handle = redis.opsForValue().get(userKey(actor));
    if (handle == null) throw missingAvailability();
    Map<Object, Object> raw = redis.opsForHash().entries(handleKey(handle));
    if (raw.isEmpty()) throw missingAvailability();
    return availability(strings(raw), clock.instant());
  }

  public void disable(String actor) {
    String handle = redis.opsForValue().getAndDelete(userKey(actor));
    if (handle == null) return;
    redis.delete(handleKey(handle));
    redis.opsForSet().remove(indexKey(), handle);
  }

  public AvailabilityView heartbeat(String actor) {
    String handle = redis.opsForValue().get(userKey(actor));
    if (handle == null) throw missingAvailability();
    Instant now = clock.instant();
    Map<Object, Object> current = redis.opsForHash().entries(handleKey(handle));
    if (current.isEmpty()) throw missingAvailability();
    Instant previous = Instant.parse(current.get("heartbeatAt").toString());
    if (previous.plusSeconds(5).isAfter(now)) {
      throw new ApiException(
          HttpStatus.TOO_MANY_REQUESTS,
          "HEARTBEAT_RATE_LIMITED",
          "Heartbeat quá nhanh",
          Duration.ofSeconds(5));
    }
    redis.opsForHash().put(handleKey(handle), "heartbeatAt", now.toString());
    redis.opsForHash().put(handleKey(handle), "expiresAt", now.plus(AVAILABILITY_TTL).toString());
    redis.expire(handleKey(handle), AVAILABILITY_TTL);
    redis.expire(userKey(actor), AVAILABILITY_TTL);
    return mine(actor);
  }

  public AvailabilityView updateAvailabilityLocation(
      String actor, double latitude, double longitude, double accuracyMeters) {
    validateCoordinates(latitude, longitude, accuracyMeters, true);
    String handle = redis.opsForValue().get(userKey(actor));
    if (handle == null) throw missingAvailability();
    Instant now = clock.instant();
    redis
        .opsForHash()
        .putAll(
            handleKey(handle),
            Map.of(
                "latitude",
                Double.toString(latitude),
                "longitude",
                Double.toString(longitude),
                "accuracy",
                Double.toString(accuracyMeters),
                "locationAt",
                now.toString()));
    return mine(actor);
  }

  public List<Candidate> search(String actor) {
    identities.require(actor);
    Set<String> handles = redis.opsForSet().members(indexKey());
    if (handles == null || handles.isEmpty()) return List.of();
    Instant now = clock.instant();
    List<Candidate> result = new ArrayList<>();
    for (String handle : handles) {
      Map<Object, Object> raw = redis.opsForHash().entries(handleKey(handle));
      if (raw.isEmpty()) {
        redis.opsForSet().remove(indexKey(), handle);
        continue;
      }
      Map<String, String> value = strings(raw);
      if (actor.equals(value.get("driverId"))) continue;
      Instant heartbeat = Instant.parse(value.get("heartbeatAt"));
      var trip = rides.trip(value.get("tripId"));
      if (heartbeat.plus(SEARCHABLE_AGE).isBefore(now)
          || trip.isEmpty()
          || !"OPEN".equals(trip.get().status())
          || trip.get().remainingSeats() < 1) continue;
      AreaCenter center =
          value.containsKey("latitude")
              ? blur(
                  Double.parseDouble(value.get("latitude")),
                  Double.parseDouble(value.get("longitude")))
              : null;
      Instant updated =
          value.containsKey("locationAt") ? Instant.parse(value.get("locationAt")) : heartbeat;
      result.add(
          new Candidate(
              handle,
              value.get("tripId"),
              center,
              500,
              updated,
              updated.plus(SEARCHABLE_AGE).isBefore(now),
              center != null));
      if (result.size() == 20) break;
    }
    return List.copyOf(result);
  }

  public RideService.ProposalView propose(
      String actor, String handle, String postId, String quoteId, String idempotencyKey) {
    Map<Object, Object> raw = redis.opsForHash().entries(handleKey(handle));
    if (raw.isEmpty()) throw conflict("AVAILABILITY_EXPIRED");
    Map<String, String> value = strings(raw);
    return rideService.propose(
        actor,
        new RideService.CreateProposal(postId, value.get("tripId"), quoteId),
        idempotencyKey);
  }

  @Transactional
  public void consent(String actor, String bookingId, boolean enabled) {
    var booking = participant(actor, bookingId);
    if (!booking.active()) throw forbidden("LOCATION_CONSENT_REQUIRED");
    if (identities.require(actor).locked() && !booking.aboard()) {
      throw forbidden("ACCOUNT_LOCKED");
    }
    Instant now = clock.instant();
    String id = bookingId + ":" + actor;
    mongo.upsert(
        Query.query(Criteria.where("_id").is(id)),
        enabled
            ? new Update()
                .setOnInsert("bookingId", bookingId)
                .setOnInsert("userId", actor)
                .set("enabledAt", now)
                .unset("disabledAt")
                .unset("revokedAt")
                .inc("version", 1)
            : new Update()
                .setOnInsert("bookingId", bookingId)
                .setOnInsert("userId", actor)
                .set("disabledAt", now)
                .inc("version", 1),
        LiveLocationConsent.class);
    if (!enabled) redis.delete(locationKey(bookingId, actor));
  }

  public LocationView updateLiveLocation(
      String actor,
      String bookingId,
      String clientLocationId,
      String source,
      double latitude,
      double longitude,
      double accuracyMeters) {
    var booking = participant(actor, bookingId);
    if (!booking.active()) throw forbidden("LOCATION_CONSENT_REQUIRED");
    if (identities.require(actor).locked() && !booking.aboard()) {
      throw forbidden("ACCOUNT_LOCKED");
    }
    if (clientLocationId == null
        || !clientLocationId.matches("[0-9a-fA-F-]{36}")
        || !"GPS".equals(source)) throw invalid("LOCATION_INVALID");
    validateCoordinates(latitude, longitude, accuracyMeters, true);
    if (!consented(bookingId, actor)) throw forbidden("LOCATION_CONSENT_REQUIRED");
    String dedupe = locationDedupeKey(bookingId, actor, clientLocationId);
    String old = redis.opsForValue().get(dedupe);
    if (old != null) return readLocation(actor, old);
    Instant now = clock.instant();
    String latest = locationKey(bookingId, actor);
    Map<Object, Object> prior = redis.opsForHash().entries(latest);
    if (!prior.isEmpty()) {
      Instant previous = Instant.parse(prior.get("updatedAt").toString());
      if (previous.plusSeconds(5).isAfter(now))
        throw new ApiException(
            HttpStatus.TOO_MANY_REQUESTS,
            "LOCATION_RATE_LIMITED",
            "Vị trí được cập nhật quá nhanh",
            Duration.ofSeconds(5));
    }
    redis
        .opsForHash()
        .putAll(
            latest,
            Map.of(
                "userId",
                actor,
                "latitude",
                Double.toString(latitude),
                "longitude",
                Double.toString(longitude),
                "accuracy",
                Double.toString(accuracyMeters),
                "source",
                source,
                "updatedAt",
                now.toString(),
                "clientLocationId",
                clientLocationId));
    redis.expire(latest, LOCATION_TTL);
    redis.opsForValue().set(dedupe, latest, LOCATION_TTL);
    LocationView view =
        new LocationView(actor, latitude, longitude, accuracyMeters, source, now, false);
    String recipient = booking.counterpart(actor);
    try {
      realtime.publish(
          new RealtimeEnvelope(
              UUID.randomUUID().toString(),
              "location.updated",
              1,
              recipient,
              "/queue/bookings",
              Map.of("bookingId", bookingId, "location", view),
              now));
    } catch (RuntimeException ignored) {
      // REST reconciliation remains authoritative.
    }
    return view;
  }

  public LiveLocationView locations(String actor, String bookingId) {
    var booking = participant(actor, bookingId);
    if (!booking.active()) return new LiveLocationView(List.of());
    String counterpart = booking.counterpart(actor);
    if (!consented(bookingId, counterpart)) return new LiveLocationView(List.of());
    String key = locationKey(bookingId, counterpart);
    if (!Boolean.TRUE.equals(redis.hasKey(key))) return new LiveLocationView(List.of());
    return new LiveLocationView(List.of(readLocation(counterpart, key)));
  }

  private RideParticipantAccess.BookingParticipants participant(String actor, String bookingId) {
    var booking = rides.booking(bookingId).orElseThrow(AvailabilityService::missing);
    if (!booking.participant(actor)) throw missing();
    return booking;
  }

  private boolean consented(String bookingId, String userId) {
    LiveLocationConsent consent =
        mongo.findById(bookingId + ":" + userId, LiveLocationConsent.class);
    return consent != null
        && consent.enabledAt() != null
        && consent.disabledAt() == null
        && consent.revokedAt() == null;
  }

  private LocationView readLocation(String expectedUser, String key) {
    Map<Object, Object> raw = redis.opsForHash().entries(key);
    if (raw.isEmpty() || !expectedUser.equals(raw.get("userId"))) throw missingLocation();
    Instant updated = Instant.parse(raw.get("updatedAt").toString());
    return new LocationView(
        expectedUser,
        Double.parseDouble(raw.get("latitude").toString()),
        Double.parseDouble(raw.get("longitude").toString()),
        Double.parseDouble(raw.get("accuracy").toString()),
        raw.get("source").toString(),
        updated,
        updated.plus(LOCATION_STALE).isBefore(clock.instant()));
  }

  private AvailabilityView availability(Map<String, String> value, Instant now) {
    Instant heartbeat = Instant.parse(value.get("heartbeatAt"));
    AreaCenter center =
        value.containsKey("latitude")
            ? blur(
                Double.parseDouble(value.get("latitude")),
                Double.parseDouble(value.get("longitude")))
            : null;
    return new AvailabilityView(
        value.get("handle"),
        value.get("tripId"),
        Instant.parse(value.get("enabledAt")),
        heartbeat,
        Instant.parse(value.get("expiresAt")),
        center,
        500,
        heartbeat.plus(SEARCHABLE_AGE).isBefore(now),
        center != null);
  }

  private Map<String, String> strings(Map<Object, Object> raw) {
    Map<String, String> result = new java.util.HashMap<>();
    raw.forEach((key, value) -> result.put(key.toString(), value.toString()));
    return result;
  }

  private AreaCenter blur(double latitude, double longitude) {
    double latStep = 500d / 111_320d;
    double lonStep = 500d / (111_320d * Math.max(0.2, Math.cos(Math.toRadians(latitude))));
    return new AreaCenter(
        Math.rint(latitude / latStep) * latStep, Math.rint(longitude / lonStep) * lonStep);
  }

  private void validateCoordinates(
      Double latitude, Double longitude, Double accuracy, boolean required) {
    if (!required && latitude == null && longitude == null && accuracy == null) return;
    if (latitude == null
        || longitude == null
        || accuracy == null
        || !Double.isFinite(latitude)
        || !Double.isFinite(longitude)
        || !Double.isFinite(accuracy)
        || latitude < -90
        || latitude > 90
        || longitude < -180
        || longitude > 180
        || accuracy < 0
        || accuracy > 5000) throw invalid("LOCATION_INVALID");
  }

  private String userKey(String actor) {
    return "dike:" + environment + ":availability:user:" + actor;
  }

  private String handleKey(String handle) {
    return "dike:" + environment + ":availability:handle:" + handle;
  }

  private String indexKey() {
    return "dike:" + environment + ":availability:index";
  }

  private String locationKey(String booking, String user) {
    return "dike:" + environment + ":live-location:" + booking + ":" + user;
  }

  private String locationDedupeKey(String booking, String user, String id) {
    return "dike:" + environment + ":live-location-dedupe:" + booking + ":" + user + ":" + id;
  }

  private static ApiException invalid(String code) {
    return new ApiException(HttpStatus.BAD_REQUEST, code, "Dữ liệu vị trí không hợp lệ");
  }

  private static ApiException forbidden(String code) {
    return new ApiException(HttpStatus.FORBIDDEN, code, "Thao tác vị trí không được phép");
  }

  private static ApiException conflict(String code) {
    return new ApiException(HttpStatus.CONFLICT, code, "Trạng thái sẵn sàng đã thay đổi");
  }

  private static ApiException missing() {
    return new ApiException(
        HttpStatus.NOT_FOUND, "RESOURCE_NOT_AVAILABLE", "Không tìm thấy dữ liệu");
  }

  private static ApiException missingAvailability() {
    return new ApiException(
        HttpStatus.NOT_FOUND,
        "AVAILABILITY_EXPIRED",
        "Phiên sẵn sàng không tồn tại hoặc đã hết hạn");
  }

  private static ApiException missingLocation() {
    return new ApiException(
        HttpStatus.NOT_FOUND, "LOCATION_NOT_AVAILABLE", "Vị trí không còn khả dụng");
  }
}
