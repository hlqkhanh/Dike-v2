package com.dike.messaging;

import com.dike.community.SocialAccessPolicy;
import com.dike.identity.IdentityAccess;
import com.dike.shared.api.ApiException;
import com.mongodb.client.result.UpdateResult;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MessagingService implements NotificationPublisher, ConfirmedConversationPublisher {

  private final MongoTemplate mongo;
  private final SocialAccessPolicy social;
  private final IdentityAccess identities;
  private final RealtimePublisher realtime;
  private final Clock clock;
  private final RidePostAttachmentSource ridePosts;

  public MessagingService(
      MongoTemplate mongo,
      SocialAccessPolicy social,
      IdentityAccess identities,
      RealtimePublisher realtime,
      Clock clock,
      RidePostAttachmentSource ridePosts) {
    this.mongo = mongo;
    this.social = social;
    this.identities = identities;
    this.realtime = realtime;
    this.clock = clock;
    this.ridePosts = ridePosts;
  }

  public record ConversationView(
      String id,
      String type,
      String state,
      List<String> participantIds,
      String bookingId,
      Instant lastMessageAt,
      long unreadCount,
      long version,
      String recipientDisplayName,
      String recipientAvatarUrl,
      boolean canSend,
      String postId,
      String lastMessageText) {}

  public record MessageView(
      String id,
      String conversationId,
      String senderId,
      String clientMessageId,
      long sequence,
      String text,
      Instant createdAt,
      boolean hidden,
      RidePostAttachment ridePost) {}

  public record NotificationView(
      String id,
      String type,
      String title,
      String body,
      Map<String, String> data,
      Instant createdAt,
      Instant readAt) {}

  @Transactional
  public ConversationView direct(String actor, String recipientId) {
    if (recipientId == null || recipientId.isBlank() || actor.equals(recipientId)) {
      throw invalid("MESSAGE_RECIPIENT_INVALID");
    }
    if (identities.require(actor).locked()) throw forbidden("ACCOUNT_LOCKED");
    identities.require(recipientId);
    if (social.blocked(actor, recipientId)) throw forbidden("MESSAGING_BLOCKED");
    String pairKey = pair(actor, recipientId);
    Conversation existing =
        mongo.findOne(Query.query(Criteria.where("pairKey").is(pairKey)), Conversation.class);
    if (existing != null) return view(existing, actor);
    boolean open = social.friends(actor, recipientId);
    if (!open && !identities.allowsMessageRequests(recipientId)) {
      throw forbidden("MESSAGE_REQUESTS_DISABLED");
    }
    Instant now = clock.instant();
    Conversation created =
        new Conversation(
            UUID.randomUUID().toString(),
            Conversation.Type.DIRECT,
            pairKey,
            null,
            List.of(actor, recipientId).stream().sorted().toList(),
            open ? Conversation.State.OPEN : Conversation.State.REQUEST_PENDING,
            open ? null : actor,
            now,
            null,
            null,
            0,
            0);
    try {
      mongo.insert(created);
      return view(created, actor);
    } catch (DuplicateKeyException race) {
      return view(
          mongo.findOne(Query.query(Criteria.where("pairKey").is(pairKey)), Conversation.class),
          actor);
    }
  }

  @Transactional
  public ConversationView discussPost(String actor, String postId) {
    if (postId == null || postId.isBlank()) throw invalid("MESSAGE_INVALID");
    var context = ridePosts.load(actor, postId);
    return direct(actor, context.ownerId());
  }

  public ConversationView conversation(String actor, String id) {
    return view(requireConversation(actor, id), actor);
  }

  @Override
  @Transactional
  public String open(String firstUserId, String secondUserId) {
    if (firstUserId == null
        || secondUserId == null
        || firstUserId.isBlank()
        || secondUserId.isBlank()
        || firstUserId.equals(secondUserId)) {
      throw invalid("MESSAGE_RECIPIENT_INVALID");
    }
    if (identities.require(firstUserId).locked() || identities.require(secondUserId).locked()) {
      throw forbidden("ACCOUNT_LOCKED");
    }
    if (social.blocked(firstUserId, secondUserId)) throw forbidden("MESSAGING_BLOCKED");

    String pairKey = pair(firstUserId, secondUserId);
    Conversation existing =
        mongo.findOne(Query.query(Criteria.where("pairKey").is(pairKey)), Conversation.class);
    if (existing != null) {
      if (existing.state() != Conversation.State.OPEN) {
        mongo.updateFirst(
            Query.query(Criteria.where("_id").is(existing.id())),
            new Update()
                .set("state", Conversation.State.OPEN.name())
                .unset("requesterId")
                .inc("version", 1L),
            Conversation.class);
      }
      return existing.id();
    }

    Instant now = clock.instant();
    Conversation created =
        new Conversation(
            UUID.randomUUID().toString(),
            Conversation.Type.DIRECT,
            pairKey,
            null,
            List.of(firstUserId, secondUserId).stream().sorted().toList(),
            Conversation.State.OPEN,
            null,
            now,
            null,
            null,
            0,
            0);
    try {
      mongo.insert(created);
      return created.id();
    } catch (DuplicateKeyException race) {
      Conversation raced =
          mongo.findOne(Query.query(Criteria.where("pairKey").is(pairKey)), Conversation.class);
      if (raced == null) throw race;
      mongo.updateFirst(
          Query.query(Criteria.where("_id").is(raced.id())),
          new Update()
              .set("state", Conversation.State.OPEN.name())
              .unset("requesterId")
              .inc("version", 1L),
          Conversation.class);
      return raced.id();
    }
  }

  public List<ConversationView> conversations(String actor, String after, int limit) {
    page(limit);
    Criteria criteria = Criteria.where("participantIds").is(actor);
    if (after != null) criteria = criteria.and("_id").lt(after);
    List<Conversation> rows =
        mongo.find(
            Query.query(criteria)
                .with(Sort.by(Sort.Order.desc("lastMessageAt"), Sort.Order.desc("_id")))
                .limit(limit),
            Conversation.class);
    return rows.stream().map(row -> view(row, actor)).toList();
  }

  @Transactional
  public ConversationView decideRequest(String actor, String id, boolean accept, long version) {
    Conversation before = requireConversation(actor, id);
    if (before.state() != Conversation.State.REQUEST_PENDING
        || actor.equals(before.requesterId())
        || before.version() != version) throw conflict("MESSAGE_REQUEST_CHANGED");
    Conversation.State next = accept ? Conversation.State.OPEN : Conversation.State.REJECTED;
    UpdateResult result =
        mongo.updateFirst(
            Query.query(
                Criteria.where("_id")
                    .is(id)
                    .and("version")
                    .is(version)
                    .and("state")
                    .is("REQUEST_PENDING")),
            new Update().set("state", next).inc("version", 1),
            Conversation.class);
    if (result.getModifiedCount() != 1) throw conflict("MESSAGE_REQUEST_CHANGED");
    return view(requireConversation(actor, id), actor);
  }

  @Transactional
  public MessageView send(String actor, String id, String clientMessageId, String text) {
    return send(actor, id, clientMessageId, text, (String) null);
  }

  @Transactional
  public MessageView send(
      String actor, String id, String clientMessageId, String text, String postId) {
    RidePostAttachment attachment = null;
    if (postId != null) {
      var conversation = requireConversation(actor, id);
      var context = ridePosts.load(actor, postId);
      if (!context.ownerId().equals(conversation.other(actor)))
        throw forbidden("MESSAGE_ATTACHMENT_INVALID");
      attachment = context.attachment();
    }
    return persistMessage(actor, id, clientMessageId, text, attachment);
  }

  private MessageView persistMessage(
      String actor, String id, String clientMessageId, String text, RidePostAttachment ridePost) {
    Conversation conversation = requireConversation(actor, id);
    if (identities.require(actor).locked() && conversation.type() != Conversation.Type.BOOKING) {
      throw forbidden("ACCOUNT_LOCKED");
    }
    if (conversation.state() == Conversation.State.REJECTED)
      throw forbidden("CONVERSATION_READ_ONLY");
    String other = conversation.other(actor);
    if (social.blocked(actor, other)) throw forbidden("CONVERSATION_READ_ONLY");
    if (conversation.state() == Conversation.State.REQUEST_PENDING
        && !actor.equals(conversation.requesterId())) throw forbidden("MESSAGE_REQUEST_PENDING");
    if (clientMessageId == null
        || !clientMessageId.matches("[A-Za-z0-9_-]{8,100}")
        || text == null
        || (text.isBlank() && ridePost == null)
        || text.length() > 2000) throw invalid("MESSAGE_INVALID");
    ChatMessage duplicate =
        mongo.findOne(
            Query.query(
                Criteria.where("conversationId").is(id).and("clientMessageId").is(clientMessageId)),
            ChatMessage.class);
    if (duplicate != null) return view(duplicate);
    Instant now = clock.instant();
    Conversation sequenced =
        mongo.findAndModify(
            Query.query(Criteria.where("_id").is(id)),
            new Update().inc("nextSequence", 1).inc("version", 1).set("lastMessageAt", now),
            FindAndModifyOptions.options().returnNew(true),
            Conversation.class);
    if (sequenced == null) throw missing();
    ChatMessage message =
        new ChatMessage(
            UUID.randomUUID().toString(),
            id,
            actor,
            clientMessageId,
            sequenced.nextSequence(),
            text.trim(),
            now,
            false,
            ridePost);
    try {
      mongo.insert(message);
    } catch (DuplicateKeyException race) {
      return view(
          mongo.findOne(
              Query.query(
                  Criteria.where("conversationId")
                      .is(id)
                      .and("clientMessageId")
                      .is(clientMessageId)),
              ChatMessage.class));
    }
    mongo.updateFirst(
        Query.query(Criteria.where("_id").is(id)),
        new Update().set("lastMessageId", message.id()),
        Conversation.class);
    publish(
        other,
        "/queue/conversations",
        "message.created",
        message.id(),
        Map.of("conversationId", id, "messageId", message.id(), "sequence", message.sequence()));
    return view(message);
  }

  public List<MessageView> messages(String actor, String id, Long beforeSequence, int limit) {
    requireConversation(actor, id);
    page(limit);
    Criteria criteria = Criteria.where("conversationId").is(id);
    if (beforeSequence != null) criteria = criteria.and("sequence").lt(beforeSequence);
    List<ChatMessage> rows =
        mongo.find(
            Query.query(criteria).with(Sort.by(Sort.Direction.DESC, "sequence")).limit(limit),
            ChatMessage.class);
    return rows.stream().map(this::view).toList();
  }

  public void read(String actor, String id, long sequence) {
    Conversation conversation = requireConversation(actor, id);
    long bounded = Math.max(0, Math.min(sequence, conversation.nextSequence()));
    mongo.upsert(
        Query.query(Criteria.where("_id").is(readId(id, actor))),
        new Update()
            .setOnInsert("conversationId", id)
            .setOnInsert("userId", actor)
            .max("lastReadSequence", bounded)
            .set("updatedAt", clock.instant()),
        ConversationRead.class);
  }

  @Override
  public void notify(
      String userId, String type, String title, String body, Map<String, String> data) {
    Instant now = clock.instant();
    Notification notification =
        mongo.insert(
            new Notification(
                UUID.randomUUID().toString(),
                userId,
                type,
                title,
                body,
                Map.copyOf(data),
                now,
                null));
    publish(
        userId,
        "/queue/notifications",
        "notification.created",
        notification.id(),
        Map.of("notificationId", notification.id(), "type", type));
  }

  public List<NotificationView> notifications(String actor, String after, int limit) {
    page(limit);
    Criteria criteria = Criteria.where("userId").is(actor);
    if (after != null) criteria = criteria.and("_id").lt(after);
    return mongo
        .find(
            Query.query(criteria).with(Sort.by(Sort.Direction.DESC, "_id")).limit(limit),
            Notification.class)
        .stream()
        .map(this::view)
        .toList();
  }

  public void markNotificationRead(String actor, String id) {
    UpdateResult result =
        mongo.updateFirst(
            Query.query(Criteria.where("_id").is(id).and("userId").is(actor)),
            new Update().set("readAt", clock.instant()),
            Notification.class);
    if (result.getMatchedCount() != 1) throw missing();
  }

  public void markAllNotificationsRead(String actor) {
    mongo.updateMulti(
        Query.query(Criteria.where("userId").is(actor).and("readAt").is(null)),
        new Update().set("readAt", clock.instant()),
        Notification.class);
  }

  @Transactional
  public void ensureBookingConversation(String bookingId, String passengerId, String driverId) {
    if (mongo.exists(Query.query(Criteria.where("bookingId").is(bookingId)), Conversation.class))
      return;
    Instant now = clock.instant();
    try {
      mongo.insert(
          new Conversation(
              UUID.randomUUID().toString(),
              Conversation.Type.BOOKING,
              null,
              bookingId,
              List.of(passengerId, driverId).stream().sorted().toList(),
              Conversation.State.OPEN,
              null,
              now,
              null,
              null,
              0,
              0));
    } catch (DuplicateKeyException ignored) {
      // Idempotent outbox replay.
    }
  }

  private Conversation requireConversation(String actor, String id) {
    Conversation conversation = mongo.findById(id, Conversation.class);
    if (conversation == null || !conversation.participant(actor)) throw missing();
    return conversation;
  }

  private ConversationView view(Conversation value, String actor) {
    ConversationRead read = mongo.findById(readId(value.id(), actor), ConversationRead.class);
    long unread = Math.max(0, value.nextSequence() - (read == null ? 0 : read.lastReadSequence()));
    ChatMessage lastMessage =
        value.lastMessageId() == null
            ? null
            : mongo.findById(value.lastMessageId(), ChatMessage.class);
    var response =
        mongo.findOne(
            Query.query(
                    Criteria.where("conversationId")
                        .is(value.id())
                        .and("status")
                        .in("ACCEPTED", "DRIVER_STARTED", "DRIVER_ARRIVED", "COMPLETED"))
                .with(Sort.by(Sort.Direction.DESC, "updatedAt")),
            org.bson.Document.class,
            "ride_post_responses");
    return new ConversationView(
        value.id(),
        value.type().name(),
        value.state().name(),
        value.participantIds(),
        value.bookingId(),
        value.lastMessageAt(),
        unread,
        value.version(),
        identities.displayName(value.other(actor)),
        identities.avatarUrl(value.other(actor)),
        value.state() != Conversation.State.REJECTED
            && (value.state() != Conversation.State.REQUEST_PENDING
                || actor.equals(value.requesterId()))
            && !social.blocked(actor, value.other(actor))
            && (!identities.require(actor).locked() || value.type() == Conversation.Type.BOOKING),
        response == null ? null : response.getString("postId"),
        lastMessage == null ? null : lastMessage.text());
  }

  private MessageView view(ChatMessage value) {
    return new MessageView(
        value.id(),
        value.conversationId(),
        value.senderId(),
        value.clientMessageId(),
        value.sequence(),
        value.hidden() ? null : value.text(),
        value.createdAt(),
        value.hidden(),
        value.hidden() ? null : value.ridePost());
  }

  private NotificationView view(Notification value) {
    return new NotificationView(
        value.id(),
        value.type(),
        value.title(),
        value.body(),
        value.data(),
        value.createdAt(),
        value.readAt());
  }

  private void publish(
      String userId, String destination, String type, String eventId, Map<String, Object> payload) {
    try {
      realtime.publish(
          new RealtimeEnvelope(eventId, type, 1, userId, destination, payload, clock.instant()));
    } catch (RuntimeException ignored) {
      // Realtime is best effort; REST remains the source of truth.
    }
  }

  private String pair(String first, String second) {
    List<String> values = new ArrayList<>(List.of(first, second));
    values.sort(Comparator.naturalOrder());
    return values.get(0) + ":" + values.get(1);
  }

  private String readId(String conversation, String user) {
    return conversation + ":" + user;
  }

  private void page(int limit) {
    if (limit < 1 || limit > 50) throw invalid("INVALID_PAGE");
  }

  private static ApiException invalid(String code) {
    return new ApiException(HttpStatus.BAD_REQUEST, code, "Dữ liệu không hợp lệ");
  }

  private static ApiException forbidden(String code) {
    return new ApiException(HttpStatus.FORBIDDEN, code, "Thao tác nhắn tin không được phép");
  }

  private static ApiException conflict(String code) {
    return new ApiException(HttpStatus.CONFLICT, code, "Trạng thái hội thoại đã thay đổi");
  }

  private static ApiException missing() {
    return new ApiException(
        HttpStatus.NOT_FOUND, "CONVERSATION_NOT_FOUND", "Không tìm thấy hội thoại");
  }
}
