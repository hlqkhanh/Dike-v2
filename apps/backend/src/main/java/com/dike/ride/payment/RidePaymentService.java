package com.dike.ride.payment;

import com.dike.messaging.NotificationPublisher;
import com.dike.ride.RideParticipantAccess;
import com.dike.shared.api.ApiException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class RidePaymentService {
  private static final long CONTRIBUTION_PER_KM_VND = 2_000L;
  private final MongoTemplate mongo;
  private final RideParticipantAccess rides;
  private final PayOsGateway payos;
  private final PayOsProperties properties;
  private final NotificationPublisher notifications;
  private final Clock clock;

  public RidePaymentService(
      MongoTemplate mongo,
      RideParticipantAccess rides,
      PayOsGateway payos,
      PayOsProperties properties,
      NotificationPublisher notifications,
      Clock clock) {
    this.mongo = mongo;
    this.rides = rides;
    this.payos = payos;
    this.properties = properties;
    this.notifications = notifications;
    this.clock = clock;
  }

  public record View(
      String bookingId,
      long amountVnd,
      String status,
      boolean providerAvailable,
      boolean bankVerified,
      String checkoutUrl,
      String qrCode,
      Instant expiresAt,
      Instant paidAt,
      String payoutStatus,
      String payoutDestination,
      Instant paidOutAt,
      long version) {}

  public record PayoutRequest(String bankBin, String accountNumber) {}

  public View get(String actor, String bookingId) {
    var booking = participant(actor, bookingId);
    RidePayment payment = mongo.findById(booking.id(), RidePayment.class);
    if (payment != null
        && payment.payoutId() != null
        && !"SUCCEEDED".equals(payment.payoutStatus())
        && !"CANCELLED".equals(payment.payoutStatus())
        && !"REJECTED".equals(payment.payoutStatus())
        && payos.available()) {
      try {
        String status = payos.payoutStatus(payment.payoutId());
        if (!status.equals(payment.payoutStatus())) {
          Instant now = clock.instant();
          mongo.updateFirst(
              Query.query(Criteria.where("_id").is(bookingId)),
              new Update()
                  .set("payoutStatus", status)
                  .set("paidOutAt", "SUCCEEDED".equals(status) ? now : null)
                  .set("updatedAt", now)
                  .inc("version", 1),
              RidePayment.class);
          payment = mongo.findById(booking.id(), RidePayment.class);
        }
      } catch (RuntimeException ignored) {
        // Keep the last durable state; a later read retries reconciliation.
      }
    }
    return view(payment, booking);
  }

  public View checkout(String actor, String bookingId) {
    var booking = participant(actor, bookingId);
    if (!actor.equals(booking.passengerId()))
      throw forbidden("PAYMENT_PASSENGER_ONLY", "Chỉ hành khách có thể thanh toán");
    if (java.util.Set.of("CANCELLED", "NO_SHOW", "ENDED_EARLY").contains(booking.status()))
      throw conflict("PAYMENT_NOT_ELIGIBLE", "Booking không còn đủ điều kiện thanh toán");
    if (!payos.available()) throw conflict("PAYOS_NOT_CONFIGURED", "payOS chưa được cấu hình");
    RidePayment current = mongo.findById(bookingId, RidePayment.class);
    if (current != null && "PAID".equals(current.status())) return view(current, booking);
    Instant now = clock.instant();
    if (current != null && "PENDING".equals(current.status()) && current.expiresAt().isAfter(now))
      return view(current, booking);
    long orderCode = orderCode(bookingId);
    Instant expiresAt = now.plus(properties.checkoutTtl());
    var link = payos.create(orderCode, booking.agreedPriceVnd(), bookingId, expiresAt);
    RidePayment next =
        new RidePayment(
            bookingId,
            orderCode,
            booking.passengerId(),
            booking.driverId(),
            booking.agreedPriceVnd(),
            "PENDING",
            link.paymentLinkId(),
            link.checkoutUrl(),
            link.qrCode(),
            null,
            expiresAt,
            null,
            null,
            null,
            null,
            null,
            now,
            now,
            current == null ? 0 : current.version() + 1);
    mongo.save(next);
    return view(next, booking);
  }

  public void webhook(Object body) {
    PayOsGateway.VerifiedPayment verified;
    try {
      verified = payos.verify(body);
    } catch (RuntimeException error) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "PAYOS_WEBHOOK_INVALID", "Webhook payOS không hợp lệ");
    }
    RidePayment payment =
        mongo.findOne(
            Query.query(Criteria.where("orderCode").is(verified.orderCode())), RidePayment.class);
    // payOS sends a signed sample event while registering the webhook. A valid event that does
    // not belong to Dike is acknowledged and ignored so registration and retries remain safe.
    if (payment == null) return;
    if ("PAID".equals(payment.status())) return;
    if (!"00".equals(verified.code())
        || verified.amount() != payment.amountVnd()
        || !payment.paymentLinkId().equals(verified.paymentLinkId()))
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "PAYOS_WEBHOOK_MISMATCH", "Dữ liệu thanh toán không khớp");
    Instant now = clock.instant();
    var result =
        mongo.updateFirst(
            Query.query(Criteria.where("_id").is(payment.bookingId()).and("status").is("PENDING")),
            new Update()
                .set("status", "PAID")
                .set("paidAt", now)
                .set("bankReference", verified.reference())
                .set("updatedAt", now)
                .inc("version", 1),
            RidePayment.class);
    if (result.getModifiedCount() == 1)
      notifications.notify(
          payment.driverId(),
          "PAYMENT_BANK_VERIFIED",
          "Đã nhận khoản đóng góp",
          "payOS đã xác nhận hành khách thanh toán thành công.",
          Map.of("bookingId", payment.bookingId()));
  }

  public View payout(String actor, String bookingId, PayoutRequest request) {
    var booking = participant(actor, bookingId);
    if (!actor.equals(booking.driverId()))
      throw forbidden("PAYOUT_DRIVER_ONLY", "Chỉ tài xế có thể nhận tiền");
    if (!"COMPLETED".equals(booking.status()))
      throw conflict("PAYOUT_TRIP_NOT_COMPLETED", "Chỉ chi trả sau khi chuyến hoàn thành");
    if (request == null
        || request.bankBin() == null
        || !request.bankBin().matches("\\d{6}")
        || request.accountNumber() == null
        || !request.accountNumber().matches("\\d{6,19}"))
      throw conflict("PAYOUT_DESTINATION_INVALID", "Thông tin tài khoản nhận tiền không hợp lệ");
    RidePayment payment = mongo.findById(bookingId, RidePayment.class);
    if (payment == null || payment.paidAt() == null)
      throw conflict("PAYOUT_PAYMENT_REQUIRED", "Chưa có khoản thanh toán được ngân hàng xác minh");
    if (payment.payoutId() != null) return view(payment, booking);
    PayOsGateway.CreatedPayout payout;
    try {
      payout =
          payos.payout(bookingId, payment.amountVnd(), request.bankBin(), request.accountNumber());
    } catch (RuntimeException error) {
      throw new ApiException(
          HttpStatus.BAD_GATEWAY, "PAYOS_PAYOUT_FAILED", "payOS chưa thể tạo lệnh chi");
    }
    Instant now = clock.instant();
    String masked =
        request.bankBin()
            + " · ****"
            + request.accountNumber().substring(Math.max(0, request.accountNumber().length() - 4));
    mongo.updateFirst(
        Query.query(Criteria.where("_id").is(bookingId).and("payoutId").is(null)),
        new Update()
            .set("payoutId", payout.payoutId())
            .set("payoutStatus", payout.status())
            .set("payoutDestination", masked)
            .set("paidOutAt", "SUCCEEDED".equals(payout.status()) ? now : null)
            .set("updatedAt", now)
            .inc("version", 1),
        RidePayment.class);
    return view(mongo.findById(bookingId, RidePayment.class), booking);
  }

  private View view(RidePayment value, RideParticipantAccess.BookingParticipants booking) {
    if (value == null)
      return new View(
          booking.id(),
          booking.agreedPriceVnd(),
          payos.available() ? "NOT_STARTED" : "UNAVAILABLE",
          payos.available(),
          false,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          0);
    return new View(
        value.bookingId(),
        value.amountVnd(),
        value.status(),
        payos.available(),
        value.paidAt() != null,
        value.checkoutUrl(),
        value.qrCode(),
        value.expiresAt(),
        value.paidAt(),
        value.payoutStatus(),
        value.payoutDestination(),
        value.paidOutAt(),
        value.version());
  }

  private RideParticipantAccess.BookingParticipants participant(String actor, String bookingId) {
    Optional<RideParticipantAccess.BookingParticipants> storedBooking = rides.booking(bookingId);
    if (storedBooking.isPresent()) {
      var booking = storedBooking.get();
      if (!booking.participant(actor)) throw missing();
      return booking;
    }
    org.bson.Document response =
        mongo.findById(bookingId, org.bson.Document.class, "ride_post_responses");
    if (response == null) throw missing();
    String ownerId = response.getString("ownerId");
    String requesterId = response.getString("requesterId");
    if (!actor.equals(ownerId) && !actor.equals(requesterId)) throw missing();
    String driverId = "REQUEST_RIDE".equals(response.getString("action")) ? ownerId : requesterId;
    String passengerId = driverId.equals(ownerId) ? requesterId : ownerId;
    return new RideParticipantAccess.BookingParticipants(
        bookingId,
        response.getString("postId"),
        passengerId,
        driverId,
        response.getString("status"),
        false,
        true,
        responseAmount(response.getString("postId")),
        clock.instant(),
        ((Number) response.getOrDefault("version", 0)).longValue());
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
    return Math.max(0, Math.round(CONTRIBUTION_PER_KM_VND * distance.doubleValue() / 1000d));
  }

  private static ApiException missing() {
    return new ApiException(
        HttpStatus.NOT_FOUND, "RESOURCE_NOT_AVAILABLE", "Không tìm thấy booking");
  }

  private static long orderCode(String bookingId) {
    try {
      byte[] hash =
          MessageDigest.getInstance("SHA-256").digest(bookingId.getBytes(StandardCharsets.UTF_8));
      return 100_000_000_000L + Math.floorMod(ByteBuffer.wrap(hash).getLong(), 800_000_000_000L);
    } catch (Exception error) {
      throw new IllegalStateException(error);
    }
  }

  private static ApiException forbidden(String code, String message) {
    return new ApiException(HttpStatus.FORBIDDEN, code, message);
  }

  private static ApiException conflict(String code, String message) {
    return new ApiException(HttpStatus.CONFLICT, code, message);
  }
}
