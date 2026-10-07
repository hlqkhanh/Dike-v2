package com.dike.trust.application;

import com.dike.messaging.NotificationPublisher;
import com.dike.ride.RideParticipantAccess;
import com.dike.shared.api.ApiException;
import com.dike.shared.outbox.OutboxPublisher;
import com.dike.trust.RatingSummary;
import com.dike.trust.Review;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReviewService {

  private static final Duration WINDOW = Duration.ofDays(7);
  private final MongoTemplate mongo;
  private final RideParticipantAccess rides;
  private final NotificationPublisher notifications;
  private final OutboxPublisher outbox;
  private final Clock clock;

  public ReviewService(
      MongoTemplate mongo,
      RideParticipantAccess rides,
      NotificationPublisher notifications,
      OutboxPublisher outbox,
      Clock clock) {
    this.mongo = mongo;
    this.rides = rides;
    this.notifications = notifications;
    this.outbox = outbox;
    this.clock = clock;
  }

  public record Eligibility(
      String bookingId,
      boolean eligible,
      String revieweeId,
      String revieweeRole,
      Instant deadline,
      boolean submitted) {}

  public record ReviewView(
      String id,
      String reviewerId,
      String reviewerDisplayName,
      String revieweeId,
      String role,
      int stars,
      String comment,
      String publicationStatus,
      String moderationStatus,
      Instant publishedAt) {}

  public record RatingView(String userId, String role, Double average, long reviewCount) {}

  public Eligibility eligibility(String actor, String bookingId) {
    var booking = booking(actor, bookingId);
    Instant deadline = booking.updatedAt().plus(WINDOW);
    boolean completed = "COMPLETED".equals(booking.status());
    boolean submitted = existing(bookingId, actor) != null;
    return new Eligibility(
        bookingId,
        completed && clock.instant().isBefore(deadline) && !submitted,
        booking.counterpart(actor),
        actor.equals(booking.passengerId()) ? "DRIVER" : "PASSENGER",
        deadline,
        submitted);
  }

  @Transactional
  public ReviewView submit(String actor, String bookingId, int stars, String comment) {
    var eligibility = eligibility(actor, bookingId);
    if (!eligibility.eligible()) {
      if (eligibility.submitted()) throw conflict("REVIEW_ALREADY_SUBMITTED");
      if (!clock.instant().isBefore(eligibility.deadline())) throw conflict("REVIEW_WINDOW_CLOSED");
      throw forbidden("REVIEW_NOT_ELIGIBLE");
    }
    if (stars < 1 || stars > 5) throw invalid("REVIEW_TARGET_INVALID");
    String normalized = comment == null || comment.isBlank() ? null : comment.trim();
    if (normalized != null && normalized.codePointCount(0, normalized.length()) > 1000) {
      throw invalid("REVIEW_TARGET_INVALID");
    }
    Instant now = clock.instant();
    Review review =
        new Review(
            UUID.randomUUID().toString(),
            bookingId,
            actor,
            eligibility.revieweeId(),
            Review.Role.valueOf(eligibility.revieweeRole()),
            stars,
            normalized,
            now,
            eligibility.deadline(),
            Review.Publication.PENDING,
            null,
            Review.Moderation.VISIBLE,
            null,
            null,
            null,
            0);
    try {
      mongo.insert(review);
    } catch (DuplicateKeyException race) {
      throw conflict("REVIEW_ALREADY_SUBMITTED");
    }
    List<Review> pair =
        mongo.find(Query.query(Criteria.where("bookingId").is(bookingId)), Review.class);
    if (pair.size() == 2) publish(pair, now);
    Review saved = mongo.findById(review.id(), Review.class);
    return view(saved, actor, true);
  }

  public List<ReviewView> bookingReviews(String actor, String bookingId) {
    booking(actor, bookingId);
    return mongo.find(Query.query(Criteria.where("bookingId").is(bookingId)), Review.class).stream()
        .filter(
            r ->
                r.reviewerId().equals(actor)
                    || r.publicationStatus() == Review.Publication.PUBLISHED)
        .map(r -> view(r, actor, r.reviewerId().equals(actor)))
        .toList();
  }

  public List<ReviewView> publicReviews(
      String viewer, String userId, String role, String cursor, int limit) {
    if (limit < 1 || limit > 50) throw invalid("INVALID_PAGE");
    Criteria criteria =
        Criteria.where("revieweeId")
            .is(userId)
            .and("revieweeRole")
            .is(role)
            .and("publicationStatus")
            .is("PUBLISHED")
            .and("moderationStatus")
            .is("VISIBLE");
    if (cursor != null) criteria = criteria.and("_id").lt(cursor);
    return mongo
        .find(
            Query.query(criteria).with(Sort.by(Sort.Direction.DESC, "_id")).limit(limit),
            Review.class)
        .stream()
        .map(r -> view(r, viewer, false))
        .toList();
  }

  public List<ReviewView> mine(String actor) {
    return mongo
        .find(
            Query.query(Criteria.where("reviewerId").is(actor))
                .with(Sort.by(Sort.Direction.DESC, "submittedAt")),
            Review.class)
        .stream()
        .map(r -> view(r, actor, true))
        .toList();
  }

  public List<RatingView> ratings(String userId) {
    return java.util.Arrays.stream(Review.Role.values())
        .map(
            role -> {
              RatingSummary value = mongo.findById(summaryId(userId, role), RatingSummary.class);
              return value == null
                  ? new RatingView(userId, role.name(), null, 0)
                  : new RatingView(userId, role.name(), value.average(), value.reviewCount());
            })
        .toList();
  }

  @Transactional
  public int publishDue() {
    Instant now = clock.instant();
    List<Review> due =
        mongo.find(
            Query.query(
                    Criteria.where("publicationStatus")
                        .is("PENDING")
                        .and("publishDeadline")
                        .lte(now))
                .limit(100),
            Review.class);
    for (Review review : due) publish(List.of(review), now);
    return due.size();
  }

  private void publish(List<Review> reviews, Instant now) {
    for (Review review : reviews) {
      var result =
          mongo.updateFirst(
              Query.query(
                  Criteria.where("_id").is(review.id()).and("publicationStatus").is("PENDING")),
              new Update()
                  .set("publicationStatus", Review.Publication.PUBLISHED)
                  .set("publishedAt", now)
                  .inc("version", 1),
              Review.class);
      if (result.getModifiedCount() == 1) {
        recompute(review.revieweeId(), review.revieweeRole(), now);
        outbox.publish(
            "review.published",
            "Review",
            review.id(),
            1,
            Map.of(
                "reviewId",
                review.id(),
                "revieweeId",
                review.revieweeId(),
                "role",
                review.revieweeRole().name()));
        notifications.notify(
            review.revieweeId(),
            "REVIEW_PUBLISHED",
            "Bạn có đánh giá mới",
            "Một đánh giá cho chuyến đi đã được công bố.",
            Map.of("reviewId", review.id()));
      }
    }
  }

  private void recompute(String userId, Review.Role role, Instant now) {
    List<Review> source =
        mongo.find(
            Query.query(
                Criteria.where("revieweeId")
                    .is(userId)
                    .and("revieweeRole")
                    .is(role)
                    .and("publicationStatus")
                    .is("PUBLISHED")
                    .and("moderationStatus")
                    .is("VISIBLE")),
            Review.class);
    long sum = source.stream().mapToLong(Review::stars).sum();
    long count = source.size();
    Double average = count == 0 ? null : Math.round((sum * 10.0) / count) / 10.0;
    mongo.upsert(
        Query.query(Criteria.where("_id").is(summaryId(userId, role))),
        new Update()
            .setOnInsert("userId", userId)
            .setOnInsert("role", role)
            .set("sumStars", sum)
            .set("reviewCount", count)
            .set("average", average)
            .set("sourceRevision", source.stream().mapToLong(Review::version).sum())
            .set("updatedAt", now),
        RatingSummary.class);
  }

  private Review existing(String booking, String reviewer) {
    return mongo.findOne(
        Query.query(Criteria.where("bookingId").is(booking).and("reviewerId").is(reviewer)),
        Review.class);
  }

  private RideParticipantAccess.BookingParticipants booking(String actor, String id) {
    var value = rides.booking(id).orElseThrow(ReviewService::missing);
    if (!value.participant(actor)) throw missing();
    return value;
  }

  private ReviewView view(Review review, String viewer, boolean own) {
    if (!own && review.publicationStatus() != Review.Publication.PUBLISHED)
      throw forbidden("REVIEW_NOT_PUBLISHED");
    boolean revealReviewer = own || review.reviewerId().equals(viewer);
    return new ReviewView(
        review.id(),
        revealReviewer ? review.reviewerId() : null,
        revealReviewer ? "Bạn" : "Thành viên Dike",
        review.revieweeId(),
        review.revieweeRole().name(),
        review.stars(),
        review.comment(),
        review.publicationStatus().name(),
        review.moderationStatus().name(),
        review.publishedAt());
  }

  private String summaryId(String user, Review.Role role) {
    return user + ":" + role;
  }

  private static ApiException invalid(String code) {
    return new ApiException(HttpStatus.BAD_REQUEST, code, "Đánh giá không hợp lệ");
  }

  private static ApiException forbidden(String code) {
    return new ApiException(HttpStatus.FORBIDDEN, code, "Không đủ điều kiện đánh giá");
  }

  private static ApiException conflict(String code) {
    return new ApiException(HttpStatus.CONFLICT, code, "Trạng thái đánh giá đã thay đổi");
  }

  private static ApiException missing() {
    return new ApiException(
        HttpStatus.NOT_FOUND, "RESOURCE_NOT_AVAILABLE", "Không tìm thấy booking");
  }
}
