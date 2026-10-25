package com.dike.planning.application;

import com.dike.messaging.ConfirmedConversationPublisher;
import com.dike.messaging.NotificationPublisher;
import com.dike.planning.PostAccounts;
import com.dike.shared.api.ApiException;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.bson.Document;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/** A confirmation gate between a public post CTA and the stricter quote/booking workflow. */
@Service
public class RidePostResponseService {
  private final MongoTemplate mongo;
  private final PostService posts;
  private final NotificationPublisher notifications;
  private final ConfirmedConversationPublisher conversations;
  private final PostAccounts accounts;
  private final Clock clock;
  private final PickupCompatibilityService pickups;

  public RidePostResponseService(
      MongoTemplate mongo,
      PostService posts,
      NotificationPublisher notifications,
      ConfirmedConversationPublisher conversations,
      PostAccounts accounts,
      Clock clock,
      PickupCompatibilityService pickups) {
    this.mongo = mongo;
    this.posts = posts;
    this.notifications = notifications;
    this.conversations = conversations;
    this.accounts = accounts;
    this.clock = clock;
    this.pickups = pickups;
  }

  @io.swagger.v3.oas.annotations.media.Schema(name = "RidePostInboxItem")
  public record View(
      String id,
      String postId,
      String requesterId,
      String requesterDisplayName,
      String requesterAvatarUrl,
      String companionPhone,
      String ownerId,
      String action,
      String status,
      String message,
      String conversationId,
      Instant createdAt,
      Instant updatedAt,
      long version,
      PickupCompatibilityService.View pickupCheck) {}

  public View create(String actor, String postId, String message, String pickupCheckId) {
    posts.requireReadable(actor, postId);
    Document post = mongo.findById(postId, Document.class, "ride_posts");
    if (post == null || !"OPEN".equals(post.getString("status"))) throw missing();
    String ownerId = post.getString("ownerId");
    if (actor.equals(ownerId)) {
      throw new ApiException(
          HttpStatus.CONFLICT, "SELF_POST_RESPONSE", "Bạn không thể phản hồi bài đăng của mình");
    }
    Document existing =
        mongo.findOne(
            Query.query(
                Criteria.where("postId")
                    .is(postId)
                    .and("requesterId")
                    .is(actor)
                    .and("status")
                    .in("PENDING", "ACCEPTED", "DRIVER_STARTED", "DRIVER_ARRIVED", "COMPLETED")),
            Document.class,
            "ride_post_responses");
    if (existing != null && !"PENDING".equals(existing.getString("status")))
      return view(existing, actor);
    var pickupCheck =
        "OFFER_RIDE".equals(post.getString("type"))
            ? pickups.require(actor, postId, pickupCheckId)
            : null;
    if (existing != null
        && java.util.Objects.equals(
            pickupCheck == null ? null : pickupCheck.id(), existing.getString("pickupCheckId")))
      return view(existing, actor);

    Instant now = clock.instant();
    String safeMessage = message == null ? "" : message.trim();
    if (safeMessage.length() > 300) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST,
          "POST_RESPONSE_MESSAGE_TOO_LONG",
          "Lời nhắn không được vượt quá 300 ký tự");
    }
    Document pickupData = new Document();
    if (pickupCheck != null) mongo.getConverter().write(pickupCheck, pickupData);
    if (existing != null) {
      var replacement =
          mongo.updateFirst(
              Query.query(
                  Criteria.where("_id")
                      .is(existing.getString("_id"))
                      .and("status")
                      .is("PENDING")
                      .and("version")
                      .is(existing.get("version"))),
              new Update()
                  .set("pickupCheckId", pickupCheckId)
                  .set("pickupCheck", pickupCheck == null ? null : pickupData)
                  .set("message", safeMessage)
                  .set("updatedAt", clock.instant())
                  .inc("version", 1L),
              "ride_post_responses");
      if (replacement.getModifiedCount() != 1) throw changed();
      notifications.notify(
          ownerId,
          "RIDE_POST_RESPONSE_UPDATED",
          "Điểm đón đã được cập nhật",
          "Người đi ké vừa kiểm tra lại điểm đón và tuyến đường.",
          Map.of("postId", postId, "responseId", existing.getString("_id")));
      return view(
          mongo.findById(existing.getString("_id"), Document.class, "ride_post_responses"), actor);
    }
    String action = "OFFER_RIDE".equals(post.getString("type")) ? "REQUEST_RIDE" : "OFFER_RIDE";
    Document response =
        new Document("_id", UUID.randomUUID().toString())
            .append("postId", postId)
            .append("requesterId", actor)
            .append("ownerId", ownerId)
            .append("action", action)
            .append("status", "PENDING")
            .append("message", safeMessage)
            .append("pickupCheckId", pickupCheck == null ? null : pickupCheck.id())
            .append("pickupCheck", pickupCheck == null ? null : pickupData)
            .append("createdAt", java.util.Date.from(now))
            .append("updatedAt", java.util.Date.from(now))
            .append("version", 0L);
    mongo.insert(response, "ride_post_responses");
    notifications.notify(
        ownerId,
        "RIDE_POST_RESPONSE",
        action.equals("REQUEST_RIDE") ? "Có người muốn đi ké" : "Có người muốn chở bạn",
        "Một thành viên vừa gửi yêu cầu cho hành trình của bạn.",
        Map.of("postId", postId, "responseId", response.getString("_id")));
    return view(response, actor);
  }

  public List<View> list(String actor, String postId) {
    posts.requireReadable(actor, postId);
    return mongo
        .find(
            Query.query(
                    Criteria.where("postId")
                        .is(postId)
                        .orOperator(
                            Criteria.where("ownerId").is(actor),
                            Criteria.where("requesterId").is(actor)))
                .with(Sort.by(Sort.Direction.DESC, "createdAt")),
            Document.class,
            "ride_post_responses")
        .stream()
        .map(value -> view(value, actor))
        .toList();
  }

  public List<View> active(String actor) {
    var participant =
        new Criteria()
            .orOperator(
                Criteria.where("ownerId").is(actor), Criteria.where("requesterId").is(actor));
    var query =
        Query.query(
                new Criteria()
                    .andOperator(
                        participant,
                        Criteria.where("status")
                            .in("ACCEPTED", "DRIVER_STARTED", "DRIVER_ARRIVED")))
            .with(Sort.by(Sort.Direction.DESC, "updatedAt"))
            .limit(20);
    return mongo.find(query, Document.class, "ride_post_responses").stream()
        .map(value -> view(value, actor))
        .toList();
  }

  @io.swagger.v3.oas.annotations.media.Schema(name = "RidePostInboxPage")
  public record Page(List<View> items, String nextCursor) {}

  public Page inbox(String actor, String direction, String cursor, int limit) {
    if (!List.of("sent", "received").contains(direction))
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "INVALID_RESPONSE_DIRECTION", "Bộ lọc không hợp lệ");
    String participantField = "sent".equals(direction) ? "requesterId" : "ownerId";
    var criteria = Criteria.where(participantField).is(actor);
    if (cursor != null && !cursor.isBlank()) {
      var anchor =
          mongo.findOne(
              Query.query(Criteria.where("_id").is(cursor).and(participantField).is(actor)),
              Document.class,
              "ride_post_responses");
      if (anchor == null)
        throw new ApiException(
            HttpStatus.BAD_REQUEST, "INVALID_RESPONSE_CURSOR", "Hãy tải lại danh sách yêu cầu");
      criteria =
          new Criteria()
              .andOperator(
                  criteria,
                  new Criteria()
                      .orOperator(
                          Criteria.where("createdAt").lt(anchor.getDate("createdAt")),
                          Criteria.where("createdAt")
                              .is(anchor.getDate("createdAt"))
                              .and("_id")
                              .lt(cursor)));
    }
    int size = Math.clamp(limit, 1, 50);
    var rows =
        mongo.find(
            Query.query(criteria)
                .with(Sort.by(Sort.Direction.DESC, "createdAt", "_id"))
                .limit(size + 1),
            Document.class,
            "ride_post_responses");
    boolean more = rows.size() > size;
    var visible = rows.stream().limit(size).toList();
    return new Page(
        visible.stream()
            .filter(value -> readableResponse(actor, value))
            .map(value -> view(value, actor))
            .toList(),
        more ? visible.getLast().getString("_id") : null);
  }

  private boolean readableResponse(String actor, Document response) {
    try {
      posts.requireReadable(actor, response.getString("postId"));
      return true;
    } catch (ApiException denied) {
      return false;
    }
  }

  public View decide(String actor, String id, long version, String decision) {
    if (!List.of(
            "ACCEPTED", "REJECTED", "WITHDRAWN", "DRIVER_STARTED", "DRIVER_ARRIVED", "COMPLETED")
        .contains(decision)) throw missing();
    Document current = mongo.findById(id, Document.class, "ride_post_responses");
    if (current == null) throw changed();
    String currentStatus = current.getString("status");
    boolean withdraw = "WITHDRAWN".equals(decision);
    boolean progress = List.of("DRIVER_STARTED", "DRIVER_ARRIVED", "COMPLETED").contains(decision);
    String expectedActor;
    if (progress) {
      expectedActor =
          "REQUEST_RIDE".equals(current.getString("action"))
              ? current.getString("ownerId")
              : current.getString("requesterId");
    } else {
      expectedActor = withdraw ? current.getString("requesterId") : current.getString("ownerId");
    }
    if (!actor.equals(expectedActor)) throw missing();
    String requiredStatus =
        switch (decision) {
          case "ACCEPTED", "REJECTED", "WITHDRAWN" -> "PENDING";
          case "DRIVER_STARTED" -> "ACCEPTED";
          case "DRIVER_ARRIVED" -> "DRIVER_STARTED";
          case "COMPLETED" -> "DRIVER_ARRIVED";
          default -> throw changed();
        };
    if (!requiredStatus.equals(currentStatus)) throw changed();
    if ("ACCEPTED".equals(decision) && "REQUEST_RIDE".equals(current.getString("action"))) {
      pickups.require(
          current.getString("requesterId"),
          current.getString("postId"),
          current.getString("pickupCheckId"));
    }

    var result =
        mongo.updateFirst(
            Query.query(
                Criteria.where("_id")
                    .is(id)
                    .and("version")
                    .is(version)
                    .and("status")
                    .is(requiredStatus)),
            new Update()
                .set("status", decision)
                .set("updatedAt", clock.instant())
                .inc("version", 1L),
            "ride_post_responses");
    if (result.getModifiedCount() != 1) throw changed();
    Document updated = mongo.findById(id, Document.class, "ride_post_responses");
    String conversationId = null;
    if ("ACCEPTED".equals(decision)) {
      conversationId =
          conversations.open(updated.getString("ownerId"), updated.getString("requesterId"));
      mongo.updateFirst(
          Query.query(Criteria.where("_id").is(id)),
          new Update().set("conversationId", conversationId),
          "ride_post_responses");
      updated = mongo.findById(id, Document.class, "ride_post_responses");
    }
    String driverId =
        "REQUEST_RIDE".equals(updated.getString("action"))
            ? updated.getString("ownerId")
            : updated.getString("requesterId");
    String passengerId =
        driverId.equals(updated.getString("ownerId"))
            ? updated.getString("requesterId")
            : updated.getString("ownerId");
    String target =
        progress
            ? passengerId
            : withdraw ? updated.getString("ownerId") : updated.getString("requesterId");
    Map<String, String> notificationData =
        conversationId == null
            ? Map.of("postId", updated.getString("postId"), "responseId", id)
            : Map.of(
                "postId",
                updated.getString("postId"),
                "responseId",
                id,
                "conversationId",
                conversationId);
    notifications.notify(
        target,
        "RIDE_POST_RESPONSE_" + decision,
        switch (decision) {
          case "ACCEPTED" -> "Yêu cầu đã được xác nhận";
          case "DRIVER_STARTED" -> "Người chở đã bắt đầu di chuyển";
          case "DRIVER_ARRIVED" -> "Người chở đã đến điểm đón";
          case "COMPLETED" -> "Chuyến đi đã hoàn thành";
          default -> "Yêu cầu đã được cập nhật";
        },
        switch (decision) {
          case "ACCEPTED" -> "Hai bên có thể bắt đầu trao đổi chi tiết cho hành trình.";
          case "DRIVER_STARTED" -> "Hãy chuẩn bị để có mặt tại điểm đón đúng lúc.";
          case "DRIVER_ARRIVED" -> "Người chở đang chờ bạn tại điểm đón.";
          case "COMPLETED" -> "Hành trình đồng hành đã được đánh dấu hoàn thành.";
          default -> "Trạng thái yêu cầu kết nối hành trình vừa thay đổi.";
        },
        notificationData);
    return view(updated, actor);
  }

  private View view(Document value, String actor) {
    String status = value.getString("status");
    String ownerId = value.getString("ownerId");
    String requesterId = value.getString("requesterId");
    boolean participant = actor.equals(ownerId) || actor.equals(requesterId);
    boolean matched =
        List.of("ACCEPTED", "DRIVER_STARTED", "DRIVER_ARRIVED", "COMPLETED").contains(status);
    String companionId = actor.equals(ownerId) ? requesterId : ownerId;
    return new View(
        value.getString("_id"),
        value.getString("postId"),
        requesterId,
        accounts.displayName(requesterId),
        accounts.avatarUrl(requesterId),
        participant && matched ? accounts.phoneNumber(companionId) : null,
        ownerId,
        value.getString("action"),
        status,
        value.getString("message"),
        value.getString("conversationId"),
        value.getDate("createdAt").toInstant(),
        value.getDate("updatedAt").toInstant(),
        ((Number) value.get("version")).longValue(),
        value.get("pickupCheck") instanceof Document check
            ? mongo.getConverter().read(PickupCompatibilityService.View.class, check)
            : null);
  }

  private static ApiException missing() {
    return new ApiException(
        HttpStatus.NOT_FOUND, "POST_RESPONSE_NOT_FOUND", "Không tìm thấy yêu cầu");
  }

  private static ApiException changed() {
    return new ApiException(
        HttpStatus.CONFLICT, "POST_RESPONSE_CHANGED", "Yêu cầu đã được xử lý trước đó");
  }
}
