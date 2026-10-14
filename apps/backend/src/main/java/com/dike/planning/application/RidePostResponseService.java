package com.dike.planning.application;

import com.dike.messaging.ConfirmedConversationPublisher;
import com.dike.messaging.NotificationPublisher;
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
  private final Clock clock;

  public RidePostResponseService(
      MongoTemplate mongo,
      PostService posts,
      NotificationPublisher notifications,
      ConfirmedConversationPublisher conversations,
      Clock clock) {
    this.mongo = mongo;
    this.posts = posts;
    this.notifications = notifications;
    this.conversations = conversations;
    this.clock = clock;
  }

  public record View(
      String id,
      String postId,
      String requesterId,
      String ownerId,
      String action,
      String status,
      String message,
      String conversationId,
      Instant createdAt,
      Instant updatedAt,
      long version) {}

  public View create(String actor, String postId, String message) {
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
                    .is("PENDING")),
            Document.class,
            "ride_post_responses");
    if (existing != null) return view(existing);

    Instant now = clock.instant();
    String safeMessage = message == null ? "" : message.trim();
    if (safeMessage.length() > 300) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST,
          "POST_RESPONSE_MESSAGE_TOO_LONG",
          "Lời nhắn không được vượt quá 300 ký tự");
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
            .append("createdAt", now)
            .append("updatedAt", now)
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
        value.getString("ownerId"),
        value.getString("action"),
        value.getString("status"),
        value.getString("message"),
        value.getString("conversationId"),
        value.getDate("createdAt").toInstant(),
        value.getDate("updatedAt").toInstant(),
        ((Number) value.get("version")).longValue());
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
