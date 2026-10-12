package com.dike;

import com.dike.trust.RatingSummary;
import com.dike.trust.Report;
import com.dike.trust.Review;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Date;
import java.util.List;
import java.util.Map;
import org.bson.Document;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

/** Idempotent, local-only sample data used by the web and mobile demo builds. */
@Service
@ConditionalOnExpression("'${dike.environment:local}' == 'local' && ${dike.demo.seed-enabled:true}")
public class DemoDataService implements ApplicationRunner {

  private static final String LINH = "demo-user-linh";
  private static final String MINH = "demo-user-minh";
  private static final String MAI = "demo-user-mai";
  private static final ZoneId VIETNAM = ZoneId.of("Asia/Ho_Chi_Minh");

  private final MongoTemplate mongo;
  private final Clock clock;

  public DemoDataService(MongoTemplate mongo, Clock clock) {
    this.mongo = mongo;
    this.clock = clock;
  }

  @Override
  public void run(ApplicationArguments arguments) {
    mongo.findAll(Document.class, "users").stream()
        .map(row -> row.getString("_id"))
        .filter(id -> id != null && !id.startsWith("demo-user-"))
        .forEach(this::seedFor);
  }

  public DemoSummary seedFor(String actor) {
    Instant now = clock.instant();
    seedPeople(now);
    seedSocial(actor, now);
    seedPlanning(actor, now);
    seedRides(actor, now);
    seedMessaging(actor, now);
    seedTrust(actor, now);
    return new DemoSummary(actor, 3, 5, 2, 3, 2, 2, 3);
  }

  private void seedPeople(Instant now) {
    saveUser(LINH, "Linh Nguyễn", "linh.nguyen@demo.dike.vn", now);
    saveUser(MINH, "Minh Trần", "minh.tran@demo.dike.vn", now);
    saveUser(MAI, "Mai Anh", "mai.anh@demo.dike.vn", now);
    saveProfile(
        LINH,
        "Linh Nguyễn",
        "linh nguyen",
        "Đi làm qua Cầu Giấy mỗi ngày, thích những chuyến đi đúng giờ.",
        "/images/avatars/rider-1.jpg",
        now);
    saveProfile(
        MINH,
        "Minh Trần",
        "minh tran",
        "Sinh viên Bách Khoa, thường tìm bạn đi cùng tuyến Hai Bà Trưng.",
        "/images/avatars/rider-2.jpg",
        now);
    saveProfile(
        MAI,
        "Mai Anh",
        "mai anh",
        "Cuối tuần mê trekking, ngày thường di chuyển giữa Hà Đông và Cầu Giấy.",
        "/images/avatars/rider-3.jpg",
        now);
  }

  private void saveUser(String id, String name, String email, Instant now) {
    String phone =
        switch (id) {
          case LINH -> "+84900000001";
          case MINH -> "+84900000002";
          default -> "+84900000003";
        };
    Document user =
        new Document("_id", id)
            .append("canonicalEmail", email)
            .append("displayName", name)
            .append("avatarUrl", null)
            .append("accountStatus", "ACTIVE")
            .append("onboardingStatus", "PHONE_SUBMITTED")
            .append("phoneE164", phone)
            .append("phoneStatus", "VERIFIED")
            .append("phoneVersion", 1L)
            .append("phoneVerifiedAt", date(now.minus(Duration.ofDays(30))))
            .append("verificationEvidence", null)
            .append("assignedRoles", List.of("APPROVED_DRIVER"))
            .append("authorizationVersion", 1L)
            .append("createdAt", date(now.minus(Duration.ofDays(120))))
            .append("updatedAt", date(now))
            .append("version", 0L);
    mongo.save(user, "users");
  }

  private void saveProfile(
      String id, String name, String normalized, String bio, String avatar, Instant now) {
    mongo.save(
        new Document("_id", id)
            .append("displayName", name)
            .append("normalizedDisplayName", normalized)
            .append("bio", bio)
            .append("avatarFileId", null)
            .append("avatarPublicUrl", avatar)
            .append("createdAt", date(now.minus(Duration.ofDays(120))))
            .append("updatedAt", date(now))
            .append("version", 0L),
        "user_profiles");
    mongo.save(
        new Document("_id", id)
            .append("profileVisibility", "MEMBERS")
            .append("discoverableByName", true)
            .append("allowMessageRequests", true)
            .append("updatedAt", date(now))
            .append("version", 0L),
        "user_privacy_settings");
  }

  private void seedSocial(String actor, Instant now) {
    saveRelation(actor, LINH, "ACCEPTED", LINH, "demo-friend-linh", now.minusSeconds(86400));
    saveRelation(actor, MAI, "ACCEPTED", actor, "demo-friend-mai", now.minusSeconds(172800));
    saveRelation(actor, MINH, "PENDING", MINH, "demo-request-minh", now.minusSeconds(3600));
    mongo.save(new Document("_id", actor).append("revision", 3L), "social_revisions");
  }

  private void saveRelation(
      String actor, String other, String status, String requester, String requestId, Instant at) {
    String low = actor.compareTo(other) < 0 ? actor : other;
    String high = actor.compareTo(other) < 0 ? other : actor;
    String id = low.length() + ":" + low + high;
    mongo.save(
        new Document("_id", id)
            .append("low", low)
            .append("high", high)
            .append("status", status)
            .append("requester", requester)
            .append("requestId", requestId)
            .append("cooldownUntil", null)
            .append("blockedBy", List.of())
            .append("version", 1L)
            .append("updatedAt", date(at)),
        "social_relations");
  }

  private void seedPlanning(String actor, Instant now) {
    LocalDate today = LocalDate.now(clock.withZone(VIETNAM));
    Document home = place("Nhà riêng · Hà Đông", "Hà Đông, Hà Nội", 105.7765, 20.9806, now);
    Document office = place("Keangnam Landmark 72", "Nam Từ Liêm, Hà Nội", 105.783, 21.0167, now);
    Document university =
        place("Đại học Bách Khoa Hà Nội", "Hai Bà Trưng, Hà Nội", 105.8431, 21.0055, now);

    String scheduleId = id(actor, "schedule-work");
    mongo.save(
        schedule(
            scheduleId,
            actor,
            "Đi làm hằng ngày",
            List.of("MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"),
            today.minusDays(30),
            today.plusMonths(6),
            "07:30",
            "17:30",
            office,
            home,
            List.of("OUTBOUND", "RETURN"),
            "DRIVER",
            now.minus(Duration.ofDays(20)),
            now),
        "schedule_rules");

    mongo.save(
        schedule(
            "demo-schedule-linh",
            LINH,
            "Lịch tới văn phòng",
            List.of("MONDAY", "WEDNESDAY", "FRIDAY"),
            today.minusMonths(1),
            today.plusMonths(3),
            "08:00",
            "17:45",
            office,
            university,
            List.of("OUTBOUND"),
            "RIDER",
            now.minus(Duration.ofDays(25)),
            now),
        "schedule_rules");

    String actorIntent = id(actor, "intent-outbound");
    mongo.remove(
        Query.query(
            Criteria.where("scheduleId")
                .is(scheduleId)
                .and("localDate")
                .is(localDate(today.plusDays(1)))
                .and("direction")
                .is("OUTBOUND")),
        "travel_intents");
    mongo.remove(
        Query.query(
            Criteria.where("scheduleId")
                .is("demo-schedule-linh")
                .and("localDate")
                .is(localDate(today.plusDays(1)))
                .and("direction")
                .is("OUTBOUND")),
        "travel_intents");
    mongo.save(
        intent(
            actorIntent,
            actor,
            scheduleId,
            today.plusDays(1),
            "DRIVER",
            home,
            office,
            now.plus(Duration.ofHours(18)),
            now.plus(Duration.ofHours(19)),
            null,
            now.minusSeconds(1800),
            now),
        "travel_intents");
    mongo.save(
        intent(
            "demo-intent-linh",
            LINH,
            "demo-schedule-linh",
            today.plusDays(1),
            "RIDER",
            university,
            office,
            now.plus(Duration.ofHours(18)),
            now.plus(Duration.ofHours(19)),
            actor,
            now.minusSeconds(1600),
            now),
        "travel_intents");

    List<Document> posts =
        List.of(
            post(
                "demo-post-linh",
                LINH,
                "NEED_RIDE",
                "demo-intent-linh",
                university,
                office,
                "MOTORCYCLE",
                now.plus(Duration.ofHours(18)),
                "Mình cần đến Keangnam trước 8h15, có thể đón ở cổng Trần Đại Nghĩa.",
                now.minusSeconds(900)),
            post(
                "demo-post-minh",
                MINH,
                "OFFER_RIDE",
                "demo-source-minh",
                university,
                home,
                "CAR",
                now.plus(Duration.ofDays(1)),
                "Xe còn 2 chỗ, đi qua Nguyễn Trãi. Ưu tiên bạn đúng giờ nhé!",
                now.minusSeconds(2400)),
            post(
                "demo-post-mai",
                MAI,
                "OFFER_RIDE",
                "demo-source-mai",
                home,
                office,
                "MOTORCYCLE",
                now.plus(Duration.ofHours(4)),
                "Tan làm mình về Hà Đông, có thể lệch tuyến khoảng 10 phút.",
                now.minusSeconds(5200)),
            post(
                id(actor, "post-offer"),
                actor,
                "OFFER_RIDE",
                id(actor, "trip-open"),
                home,
                office,
                "CAR",
                now.plus(Duration.ofHours(18)),
                "Đi làm tuyến Hà Đông – Keangnam, xe còn hai chỗ.",
                now.minusSeconds(300)),
            post(
                "demo-post-completed",
                MAI,
                "NEED_RIDE",
                "demo-source-old",
                office,
                home,
                "CAR",
                now.minus(Duration.ofDays(2)),
                "Chuyến đi đã ghép thành công.",
                now.minus(Duration.ofDays(3))));
    posts.forEach(value -> mongo.save(value, "ride_posts"));
    mongo.save(
        new Document("_id", actor.length() + ":" + actor + "demo-post-minh")
            .append("viewer", actor)
            .append("post", "demo-post-minh"),
        "saved_posts");
  }

  private Document schedule(
      String id,
      String owner,
      String name,
      List<String> weekdays,
      LocalDate from,
      LocalDate until,
      String start,
      String end,
      Document activity,
      Document origin,
      List<String> directions,
      String role,
      Instant createdAt,
      Instant updatedAt) {
    return new Document("_id", id)
        .append("ownerUserId", owner)
        .append("name", name)
        .append("activityCategory", "WORK")
        .append("weekdays", weekdays)
        .append("effectiveFrom", localDate(from))
        .append("effectiveUntil", localDate(until))
        .append("startLocalTime", localTime(start))
        .append("endLocalTime", localTime(end))
        .append("zoneId", "Asia/Ho_Chi_Minh")
        .append("activityPlace", activity)
        .append("usualOrigin", origin)
        .append("arrivalBufferMinutes", 15)
        .append("directions", directions)
        .append("defaultTravelRole", role)
        .append("visibility", "FRIENDS")
        .append("status", "ACTIVE")
        .append("version", 0L)
        .append("createdAt", date(createdAt))
        .append("updatedAt", date(updatedAt));
  }

  private Document intent(
      String id,
      String owner,
      String scheduleId,
      LocalDate day,
      String role,
      Document origin,
      Document destination,
      Instant earliest,
      Instant deadline,
      String matched,
      Instant created,
      Instant updated) {
    return new Document("_id", id)
        .append("ownerUserId", owner)
        .append("sourceType", "SCHEDULE")
        .append("scheduleId", scheduleId)
        .append("sourceVersion", 0L)
        .append("localDate", localDate(day))
        .append("direction", "OUTBOUND")
        .append("travelRole", role)
        .append("origin", origin)
        .append("destination", destination)
        .append("earliestDepartureAt", date(earliest))
        .append("arrivalDeadlineAt", date(deadline))
        .append("commitmentState", "PUBLISHED")
        .append("sourceChanged", false)
        .append("version", 0L)
        .append("matchedWithUserId", matched)
        .append("createdAt", date(created))
        .append("updatedAt", date(updated));
  }

  private Document post(
      String id,
      String owner,
      String type,
      String source,
      Document origin,
      Document destination,
      String vehicle,
      Instant departure,
      String note,
      Instant published) {
    return new Document("_id", id)
        .append("ownerId", owner)
        .append("type", type)
        .append("sourceId", source)
        .append("sourceVersion", 0L)
        .append("status", "OPEN")
        .append("visibility", "PUBLIC")
        .append("communityId", null)
        .append("originLabel", origin.getString("publicAreaLabel"))
        .append("destinationLabel", destination.getString("publicAreaLabel"))
        .append("vehicleType", vehicle)
        .append("routeId", null)
        .append("departureAt", date(departure))
        .append("expiresAt", date(departure.plus(Duration.ofHours(1))))
        .append("note", note)
        .append("version", 0L)
        .append("termsVersion", 1L)
        .append("closureReason", null)
        .append("publishedAt", date(published));
  }

  private void seedRides(String actor, Instant now) {
    String actorTrip = id(actor, "trip-open");
    String linhTrip = id(actor, "trip-with-linh");
    String completedTrip = id(actor, "trip-completed");
    mongo.save(
        trip(
            actorTrip,
            actor,
            "OPEN",
            3,
            2,
            now.plus(Duration.ofHours(18)),
            "Hà Đông, Hà Nội",
            "Nam Từ Liêm, Hà Nội"),
        "trips");
    mongo.save(
        trip(
            linhTrip,
            LINH,
            "FULL",
            1,
            0,
            now.plus(Duration.ofHours(4)),
            "Hai Bà Trưng, Hà Nội",
            "Cầu Giấy, Hà Nội"),
        "trips");
    mongo.save(
        trip(
            completedTrip,
            actor,
            "COMPLETED",
            3,
            2,
            now.minus(Duration.ofDays(2)),
            "Nam Từ Liêm, Hà Nội",
            "Hà Đông, Hà Nội"),
        "trips");

    mongo.save(
        trip(
            "demo-source-minh",
            MINH,
            "OPEN",
            3,
            2,
            now.plus(Duration.ofDays(1)),
            "Hai Ba Trung, Ha Noi",
            "Ha Dong, Ha Noi"),
        "trips");
    mongo.save(
        trip(
            "demo-source-mai",
            MAI,
            "OPEN",
            2,
            1,
            now.plus(Duration.ofHours(4)),
            "Ha Dong, Ha Noi",
            "Nam Tu Liem, Ha Noi"),
        "trips");

    String incomingIntent = id(actor, "proposal-intent-incoming");
    Document incomingQuote =
        quote(
            id(actor, "quote-incoming"),
            incomingIntent,
            actorTrip,
            LINH,
            actor,
            now.plus(Duration.ofHours(18)));
    Document outgoingQuote =
        quote(
            id(actor, "quote-outgoing"),
            id(actor, "intent-outbound"),
            linhTrip,
            actor,
            LINH,
            now.plus(Duration.ofHours(4)));
    mongo.save(
        proposal(
            id(actor, "proposal-incoming"),
            "demo-post-linh",
            incomingIntent,
            actorTrip,
            LINH,
            actor,
            LINH,
            actor,
            incomingQuote,
            now.plus(Duration.ofHours(2))),
        "ride_proposals");
    mongo.save(
        proposal(
            id(actor, "proposal-outgoing"),
            "demo-post-mai",
            id(actor, "intent-outbound"),
            linhTrip,
            actor,
            LINH,
            actor,
            LINH,
            outgoingQuote,
            now.plus(Duration.ofHours(1))),
        "ride_proposals");

    String activeBooking = id(actor, "booking-active");
    Document activeTerms =
        quote(
            id(actor, "quote-active"),
            id(actor, "intent-outbound"),
            linhTrip,
            actor,
            LINH,
            now.plus(Duration.ofHours(4)));
    mongo.save(
        booking(
            activeBooking,
            id(actor, "proposal-active"),
            "demo-post-mai",
            id(actor, "intent-outbound"),
            linhTrip,
            actor,
            LINH,
            "CONFIRMED",
            activeTerms,
            now.minusSeconds(600),
            0),
        "bookings");
    String completedBooking = id(actor, "booking-completed");
    Document completedTerms =
        quote(
            id(actor, "quote-completed"),
            "demo-intent-mai-old",
            completedTrip,
            MAI,
            actor,
            now.minus(Duration.ofDays(2)));
    mongo.save(
        booking(
            completedBooking,
            id(actor, "proposal-completed"),
            "demo-post-completed",
            "demo-intent-mai-old",
            completedTrip,
            MAI,
            actor,
            "COMPLETED",
            completedTerms,
            now.minus(Duration.ofDays(2)),
            2),
        "bookings");
  }

  private Document trip(
      String id,
      String driver,
      String status,
      int seats,
      int remaining,
      Instant departure,
      String origin,
      String destination) {
    return new Document("_id", id)
        .append("driverId", driver)
        .append("vehicleId", "simulated:car")
        .append("vehicleType", "CAR")
        .append("vehicleVersion", 1L)
        .append("status", status)
        .append("offeredSeats", seats)
        .append("remainingSeats", remaining)
        .append("routeId", id + ":route")
        .append("routeVersion", 1L)
        .append("termsVersion", 1L)
        .append("departureAt", date(departure))
        .append("arrivalAt", date(departure.plus(Duration.ofMinutes(45))))
        .append("originLabel", origin)
        .append("destinationLabel", destination)
        .append("visibility", "PUBLIC")
        .append("communityId", null)
        .append("contributionPerKm", 2500L)
        .append("detourMeters", 3000L)
        .append("detourSeconds", 600L)
        .append("stops", List.of())
        .append("version", 0L);
  }

  private Document proposal(
      String id,
      String postId,
      String intentId,
      String tripId,
      String passengerId,
      String driverId,
      String senderId,
      String recipientId,
      Document quote,
      Instant expiresAt) {
    return new Document("_id", id)
        .append("postId", postId)
        .append("intentId", intentId)
        .append("tripId", tripId)
        .append("passengerId", passengerId)
        .append("driverId", driverId)
        .append("senderId", senderId)
        .append("recipientId", recipientId)
        .append("direction", "PASSENGER_REQUEST")
        .append("status", "PENDING")
        .append("reason", null)
        .append("postTermsVersion", 1L)
        .append("quote", quote)
        .append("expiresAt", date(expiresAt))
        .append("version", 0L);
  }

  private Document booking(
      String id,
      String proposalId,
      String postId,
      String intentId,
      String tripId,
      String passengerId,
      String driverId,
      String status,
      Document terms,
      Instant updatedAt,
      long version) {
    return new Document("_id", id)
        .append("proposalId", proposalId)
        .append("postId", postId)
        .append("intentId", intentId)
        .append("tripId", tripId)
        .append("passengerId", passengerId)
        .append("driverId", driverId)
        .append("status", status)
        .append("agreedTerms", terms)
        .append("reason", null)
        .append("seatReleased", false)
        .append("updatedAt", date(updatedAt))
        .append("version", version);
  }

  private Document quote(
      String id, String intent, String trip, String passenger, String driver, Instant pickup) {
    return new Document("id", id)
        .append("intentId", intent)
        .append("tripId", trip)
        .append("passengerId", passenger)
        .append("driverId", driver)
        .append("tripTermsVersion", 1L)
        .append("tripRouteVersion", 1L)
        .append("routeId", trip + ":route")
        .append("priceVnd", 32000L)
        .append("pickupAt", date(pickup))
        .append("dropoffAt", date(pickup.plus(Duration.ofMinutes(40))))
        .append("expiresAt", date(clock.instant().plus(Duration.ofHours(2))))
        .append("stops", List.of())
        .append("originalDetourMeters", 1200L)
        .append("originalDetourSeconds", 300L);
  }

  private void seedMessaging(String actor, Instant now) {
    String first = id(actor, "conversation-linh");
    String second = id(actor, "conversation-mai");
    saveConversation(first, actor, LINH, "OPEN", now.minusSeconds(300), 4);
    saveConversation(second, actor, MAI, "OPEN", now.minusSeconds(3600), 2);
    saveMessage(first, 1, LINH, "Chào bạn, mai mình đón ở sảnh A nhé?", now.minusSeconds(1200));
    saveMessage(first, 2, actor, "Được bạn, 7h20 mình sẽ có mặt.", now.minusSeconds(900));
    saveMessage(first, 3, LINH, "Mình đi xe màu xanh, biển số 29A1 nhé.", now.minusSeconds(600));
    saveMessage(first, 4, actor, "Ok, hẹn bạn sáng mai!", now.minusSeconds(300));
    saveMessage(
        second, 1, actor, "Mai ơi, chiều nay bạn vẫn về Hà Đông chứ?", now.minusSeconds(4200));
    saveMessage(second, 2, MAI, "Có nhé, mình xuất phát lúc 17h45.", now.minusSeconds(3600));
    mongo.save(
        new Document("_id", first + ":" + actor)
            .append("conversationId", first)
            .append("userId", actor)
            .append("lastReadSequence", 2L)
            .append("updatedAt", date(now.minusSeconds(700))),
        "conversation_reads");
    notification(
        id(actor, "notification-1"),
        actor,
        "PROPOSAL_RECEIVED",
        "Có đề nghị đi cùng mới",
        "Linh vừa gửi đề nghị cho chuyến Hà Đông – Nam Từ Liêm.",
        Map.of("proposalId", id(actor, "proposal-incoming")),
        now.minusSeconds(420),
        null);
    notification(
        id(actor, "notification-2"),
        actor,
        "BOOKING_CONFIRMED",
        "Chuyến đi đã được xác nhận",
        "Hẹn bạn tại điểm đón lúc 17:45 hôm nay.",
        Map.of("bookingId", id(actor, "booking-active")),
        now.minusSeconds(3600),
        now.minusSeconds(3000));
    notification(
        id(actor, "notification-3"),
        actor,
        "FRIEND_REQUEST",
        "Lời mời kết bạn",
        "Minh Trần muốn kết nối với bạn.",
        Map.of("requestId", "demo-request-minh"),
        now.minusSeconds(7200),
        null);
  }

  private void saveConversation(
      String id, String actor, String other, String state, Instant lastMessageAt, long sequence) {
    List<String> participants = List.of(actor, other).stream().sorted().toList();
    mongo.save(
        new Document("_id", id)
            .append("type", "DIRECT")
            .append("pairKey", participants.get(0) + ":" + participants.get(1))
            .append("bookingId", null)
            .append("participantIds", participants)
            .append("state", state)
            .append("requesterId", null)
            .append("createdAt", date(lastMessageAt.minusSeconds(3600)))
            .append("lastMessageAt", date(lastMessageAt))
            .append("lastMessageId", id + ":message-" + sequence)
            .append("nextSequence", sequence)
            .append("version", 0L),
        "conversations");
  }

  private void saveMessage(
      String conversation, long sequence, String sender, String text, Instant at) {
    mongo.save(
        new Document("_id", conversation + ":message-" + sequence)
            .append("conversationId", conversation)
            .append("senderId", sender)
            .append("clientMessageId", "demo-" + sequence)
            .append("sequence", sequence)
            .append("text", text)
            .append("createdAt", date(at))
            .append("hidden", false),
        "messages");
  }

  private void notification(
      String id,
      String actor,
      String type,
      String title,
      String body,
      Map<String, String> data,
      Instant createdAt,
      Instant readAt) {
    mongo.save(
        new Document("_id", id)
            .append("userId", actor)
            .append("type", type)
            .append("title", title)
            .append("body", body)
            .append("data", new Document(data))
            .append("createdAt", date(createdAt))
            .append("readAt", readAt == null ? null : date(readAt)),
        "notifications");
  }

  private void seedTrust(String actor, Instant now) {
    String booking = id(actor, "booking-completed");
    mongo.save(
        new Review(
            id(actor, "review-by-mai"),
            booking,
            MAI,
            actor,
            Review.Role.DRIVER,
            5,
            "Tài xế thân thiện, lái xe an toàn và rất đúng giờ.",
            now.minus(Duration.ofDays(1)),
            now.plus(Duration.ofDays(6)),
            Review.Publication.PUBLISHED,
            now.minus(Duration.ofHours(20)),
            Review.Moderation.VISIBLE,
            null,
            null,
            null,
            1),
        "reviews");
    mongo.save(
        new RatingSummary(actor + ":DRIVER", actor, Review.Role.DRIVER, 5, 1, 5.0, 1, now),
        "rating_summaries");
    mongo.save(
        new Report(
            id(actor, "report-open"),
            actor,
            Report.TargetType.POST,
            "demo-post-minh",
            null,
            Report.Reason.MISLEADING,
            "Thông tin điểm đón trong bài chưa rõ ràng.",
            Report.Status.RECEIVED,
            Report.Priority.P2,
            null,
            Map.of("targetType", "POST", "targetId", "demo-post-minh"),
            null,
            null,
            now.minus(Duration.ofHours(6)),
            now.minus(Duration.ofHours(6)),
            null,
            0),
        "reports");
    mongo.save(
        new Report(
            id(actor, "report-resolved"),
            actor,
            Report.TargetType.MESSAGE,
            id(actor, "conversation-mai") + ":message-1",
            null,
            Report.Reason.SPAM,
            "Tin nhắn không liên quan đến chuyến đi.",
            Report.Status.RESOLVED,
            Report.Priority.P3,
            null,
            Map.of("targetType", "MESSAGE"),
            "NO_VIOLATION",
            "Đã kiểm tra và đóng báo cáo.",
            now.minus(Duration.ofDays(5)),
            now.minus(Duration.ofDays(4)),
            now.minus(Duration.ofDays(4)),
            2),
        "reports");
  }

  private Document place(
      String label, String publicLabel, double longitude, double latitude, Instant now) {
    return new Document("provider", "demo")
        .append("providerPlaceId", label)
        .append("displayLabel", label)
        .append("publicAreaLabel", publicLabel)
        .append("longitude", longitude)
        .append("latitude", latitude)
        .append("resolvedAt", date(now));
  }

  private Date localDate(LocalDate value) {
    return Date.from(value.atStartOfDay(VIETNAM).toInstant());
  }

  private Date localTime(String value) {
    return Date.from(
        LocalDate.of(1970, 1, 1)
            .atTime(java.time.LocalTime.parse(value))
            .atZone(VIETNAM)
            .toInstant());
  }

  private String id(String actor, String suffix) {
    return "demo:" + actor + ":" + suffix;
  }

  private Date date(Instant instant) {
    return Date.from(instant);
  }

  public record DemoSummary(
      String userId,
      int people,
      int posts,
      int schedulesAndIntents,
      int trips,
      int proposals,
      int bookings,
      int notifications) {}
}
