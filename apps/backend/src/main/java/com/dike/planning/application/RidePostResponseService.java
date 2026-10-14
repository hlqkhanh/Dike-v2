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

  public record View(
      String id,
      String postId,
      String requesterId,
      String requesterDisplayName,
      String requesterAvatarUrl,
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
    var pickupCheck =
        "OFFER_RIDE".equals(post.getString("type"))
            ? pickups.require(actor, postId, pickupCheckId)
            : null;
    Document existing =
        mongo.findOne(
            Query.query(
                Criteria.where("postId")
                    .is(postId)
                    .and("requesterId")
                    .is(actor)
                    .and("status")
                    .is("PENDING")),
            Document.class,
            "ride_post_responses");
    if (existing != null
        && (pickupCheck == null || pickupCheck.id().equals(existing.getString("pickupCheckId"))))
      return view(existing);

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
                  .set("pickupCheck", pickupData)
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
      return view(mongo.findById(existing.getString("_id"), Document.class, "ride_post_responses"));
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
    return view(response);
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
        .map(this::view)
        .toList();
  }

  public View decide(String actor, String id, long version, String decision) {
    if (!List.of("ACCEPTED", "REJECTED", "WITHDRAWN").contains(decision)) throw missing();
    Document current = mongo.findById(id, Document.class, "ride_post_responses");
    if (current == null || !"PENDING".equals(current.getString("status"))) throw changed();
    boolean withdraw = "WITHDRAWN".equals(decision);
    String expectedActor =
        withdraw ? current.getString("requesterId") : current.getString("ownerId");
    if (!actor.equals(expectedActor)) throw missing();
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
                    .is("PENDING")),
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
    String target = withdraw ? updated.getString("ownerId") : updated.getString("requesterId");
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
        decision.equals("ACCEPTED") ? "Yêu cầu đã được xác nhận" : "Yêu cầu đã được cập nhật",
        decision.equals("ACCEPTED")
            ? "Hai bên có thể bắt đầu trao đổi chi tiết cho hành trình."
            : "Trạng thái yêu cầu kết nối hành trình vừa thay đổi.",
        notificationData);
    return view(updated);
  }

  private View view(Document value) {
    return new View(
        value.getString("_id"),
        value.getString("postId"),
        value.getString("requesterId"),
        accounts.displayName(value.getString("requesterId")),
        accounts.avatarUrl(value.getString("requesterId")),
        value.getString("ownerId"),
        value.getString("action"),
        value.getString("status"),
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
