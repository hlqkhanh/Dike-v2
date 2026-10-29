package com.dike.ride;

import com.dike.messaging.NotificationPublisher;
import com.dike.shared.api.ApiException;
import com.mongodb.client.result.UpdateResult;
import java.time.Clock;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PaymentAcknowledgementService {
  private static final long CONTRIBUTION_PER_KM_VND = 2_000L;

  private final MongoTemplate mongo;
  private final RideParticipantAccess rides;
  private final NotificationPublisher notifications;
  private final Clock clock;

  public PaymentAcknowledgementService(
      MongoTemplate mongo,
      RideParticipantAccess rides,
      NotificationPublisher notifications,
      Clock clock) {
    this.mongo = mongo;
    this.rides = rides;
    this.notifications = notifications;
    this.clock = clock;
  }

  public record View(
      String bookingId,
      long amountVnd,
      Instant passengerPaidAt,
      Instant driverReceivedAt,
      String status,
      boolean locked,
      boolean bankVerified,
      long version) {}

  @Transactional
  public View get(String actor, String bookingId) {
    var booking = participant(actor, bookingId);
    return view(getOrCreate(booking));
  }

  @Transactional
  public View acknowledge(String actor, String bookingId, boolean paid) {
    var booking = participant(actor, bookingId);
    ensureEligible(booking);
    if (paid != actor.equals(booking.passengerId())) throw forbidden();
    PaymentAcknowledgement current = getOrCreate(booking);
    boolean already = paid ? current.passengerPaidAt() != null : current.driverReceivedAt() != null;
    if (already) return view(current);
    Instant now = clock.instant();
    Update update = new Update().inc("version", 1);
    if (paid) update.set("passengerPaidAt", now);
    else update.set("driverReceivedAt", now);
    boolean completes =
        paid ? current.driverReceivedAt() != null : current.passengerPaidAt() != null;
    if (completes) update.set("lockedAt", now);
    UpdateResult result =
        mongo.updateFirst(
            Query.query(
                Criteria.where("_id")
                    .is(bookingId)
                    .and("version")
                    .is(current.version())
                    .and("lockedAt")
                    .is(null)),
            update,
            PaymentAcknowledgement.class);
    if (result.getModifiedCount() != 1) throw conflict("PAYMENT_ACK_CHANGED");
    PaymentAcknowledgement next = mongo.findById(bookingId, PaymentAcknowledgement.class);
    notifications.notify(
        booking.counterpart(actor),
        paid ? "PAYMENT_REPORTED_PAID" : "PAYMENT_REPORTED_RECEIVED",
        paid ? "Hành khách đã báo đã trả" : "Tài xế đã báo đã nhận",
        "Đây là xác nhận giữa hai thành viên; Dike không xác minh giao dịch ngân hàng.",
        Map.of("bookingId", bookingId));
    return view(next);
  }

  @Transactional
  public View retract(String actor, String bookingId, boolean paid) {
    var booking = participant(actor, bookingId);
    if (paid != actor.equals(booking.passengerId())) throw forbidden();
    PaymentAcknowledgement current = getOrCreate(booking);
    if (current.lockedAt() != null
        || (paid && current.driverReceivedAt() != null)
        || (!paid && current.passengerPaidAt() != null)) {
      throw conflict("PAYMENT_ACK_LOCKED");
    }
    boolean absent = paid ? current.passengerPaidAt() == null : current.driverReceivedAt() == null;
    if (absent) return view(current);
    Update update = new Update().inc("version", 1);
    if (paid) update.unset("passengerPaidAt");
    else update.unset("driverReceivedAt");
    Criteria criteria =
        Criteria.where("_id")
            .is(bookingId)
            .and("version")
            .is(current.version())
            .and("lockedAt")
            .is(null)
            .and(paid ? "driverReceivedAt" : "passengerPaidAt")
            .is(null);
    if (mongo
            .updateFirst(Query.query(criteria), update, PaymentAcknowledgement.class)
            .getModifiedCount()
        != 1) throw conflict("PAYMENT_ACK_LOCKED");
    return view(mongo.findById(bookingId, PaymentAcknowledgement.class));
  }

  private PaymentAcknowledgement getOrCreate(Participant booking) {
    PaymentAcknowledgement current = mongo.findById(booking.id(), PaymentAcknowledgement.class);
    if (current != null) {
      if (current.lockedAt() == null && current.amountVnd() != booking.agreedPriceVnd()) {
        mongo.updateFirst(
            Query.query(
                Criteria.where("_id")
                    .is(booking.id())
                    .and("version")
                    .is(current.version())
                    .and("lockedAt")
                    .is(null)),
            new Update().set("amountVnd", booking.agreedPriceVnd()).inc("version", 1),
            PaymentAcknowledgement.class);
        return mongo.findById(booking.id(), PaymentAcknowledgement.class);
      }
      return current;
    }
    try {
      return mongo.insert(
          new PaymentAcknowledgement(
              booking.id(),
              booking.passengerId(),
              booking.driverId(),
              booking.agreedPriceVnd(),
              null,
              null,
              null,
              0));
    } catch (DuplicateKeyException race) {
      return mongo.findById(booking.id(), PaymentAcknowledgement.class);
    }
  }

  private Participant participant(String actor, String bookingId) {
    Optional<RideParticipantAccess.BookingParticipants> storedBooking = rides.booking(bookingId);
    if (storedBooking.isPresent()) {
      var booking = storedBooking.get();
      if (!booking.participant(actor)) throw missing();
      return new Participant(
          booking.id(),
          booking.passengerId(),
          booking.driverId(),
          booking.status(),
          booking.agreedPriceVnd());
    }
    org.bson.Document response =
        mongo.findById(bookingId, org.bson.Document.class, "ride_post_responses");
    if (response == null) throw missing();
    String ownerId = response.getString("ownerId");
    String requesterId = response.getString("requesterId");
    if (!actor.equals(ownerId) && !actor.equals(requesterId)) throw missing();
    String driverId = "REQUEST_RIDE".equals(response.getString("action")) ? ownerId : requesterId;
    String passengerId = driverId.equals(ownerId) ? requesterId : ownerId;
    return new Participant(
        bookingId,
        passengerId,
        driverId,
        response.getString("status"),
        responseAmount(response.getString("postId")));
  }

  private long responseAmount(String postId) {
    org.bson.Document post = mongo.findById(postId, org.bson.Document.class, "ride_posts");
    if (post == null) return 0;
    String routeId = post.getString("routeId");
    org.bson.Document route =
        routeId == null
            ? null
            : mongo.findById(routeId, org.bson.Document.class, "route_snapshots");
    Number distance = route == null ? null : (Number) route.get("distanceMeters");
    if (distance == null) return 0;
    return Math.max(
        0, Math.round(CONTRIBUTION_PER_KM_VND * distance.doubleValue() / 1000d));
  }

  private void ensureEligible(Participant booking) {
    if (java.util.Set.of("CANCELLED", "NO_SHOW", "ENDED_EARLY").contains(booking.status())) {
      throw conflict("PAYMENT_ACK_NOT_ELIGIBLE");
    }
  }

  private View view(PaymentAcknowledgement value) {
    String status =
        value.passengerPaidAt() != null && value.driverReceivedAt() != null
            ? "BOTH_CONFIRMED"
            : value.passengerPaidAt() != null
                ? "PASSENGER_REPORTED_PAID"
                : value.driverReceivedAt() != null ? "DRIVER_REPORTED_RECEIVED" : "NONE";
    return new View(
        value.bookingId(),
        value.amountVnd(),
        value.passengerPaidAt(),
        value.driverReceivedAt(),
        status,
        value.lockedAt() != null,
        false,
        value.version());
  }

  private record Participant(
      String id, String passengerId, String driverId, String status, long agreedPriceVnd) {
    boolean participant(String actor) {
      return passengerId.equals(actor) || driverId.equals(actor);
    }

    String counterpart(String actor) {
      return passengerId.equals(actor) ? driverId : passengerId;
    }
  }

  private static ApiException forbidden() {
    return new ApiException(
        HttpStatus.FORBIDDEN, "PAYMENT_ACK_FORBIDDEN", "Bạn không thể xác nhận thay phía còn lại");
  }

  private static ApiException conflict(String code) {
    return new ApiException(HttpStatus.CONFLICT, code, "Xác nhận chi phí đã thay đổi hoặc bị khóa");
  }

  private static ApiException missing() {
    return new ApiException(
        HttpStatus.NOT_FOUND, "RESOURCE_NOT_AVAILABLE", "Không tìm thấy booking");
  }
}
