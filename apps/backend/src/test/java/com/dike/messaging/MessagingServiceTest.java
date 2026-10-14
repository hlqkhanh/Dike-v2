package com.dike.messaging;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.dike.community.SocialAccessPolicy;
import com.dike.identity.IdentityAccess;
import com.dike.shared.api.ApiException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;

class MessagingServiceTest {
  private final MongoTemplate mongo = mock(MongoTemplate.class);
  private final SocialAccessPolicy social = mock(SocialAccessPolicy.class);
  private final IdentityAccess identities = mock(IdentityAccess.class);
  private final RidePostAttachmentSource posts = mock(RidePostAttachmentSource.class);
  private final Instant now = Instant.parse("2026-10-14T08:00:00Z");
  private final RidePostAttachment attachment =
      new RidePostAttachment(
          "demo:owner:post-offer", "OFFER_RIDE", "Hà Đông", "Nam Từ Liêm", now, "CAR", 2, 1000L);
  private MessagingService service;

  @BeforeEach
  void setup() {
    service =
        spy(
            new MessagingService(
                mongo,
                social,
                identities,
                mock(RealtimePublisher.class),
                Clock.fixed(now, ZoneOffset.UTC),
                posts));
    when(identities.require(anyString())).thenReturn(mock(IdentityAccess.Access.class));
    when(posts.load("viewer", attachment.postId()))
        .thenReturn(new RidePostAttachmentSource.Context("owner", attachment));
    when(mongo.findById("chat", Conversation.class))
        .thenReturn(conversation(Conversation.State.OPEN, null, 0));
    when(mongo.findAndModify(
            any(Query.class),
            any(Update.class),
            any(FindAndModifyOptions.class),
            eq(Conversation.class)))
        .thenReturn(conversation(Conversation.State.OPEN, null, 1));
    doReturn(
            new MessagingService.ConversationView(
                "chat",
                "DIRECT",
                "OPEN",
                List.of("viewer", "owner"),
                null,
                now,
                0,
                1,
                "Owner",
                null,
                true))
        .when(service)
        .direct("viewer", "owner");
  }

  private Conversation conversation(Conversation.State state, String requester, long sequence) {
    return new Conversation(
        "chat",
        Conversation.Type.DIRECT,
        "owner:viewer",
        null,
        List.of("viewer", "owner"),
        state,
        requester,
        now,
        now,
        null,
        sequence,
        0);
  }

  @Test
  void openingPostDiscussionUsesTrustedOwnerWithoutSending() {
    var result = service.discussPost("viewer", attachment.postId());
    assertThat(result.id()).isEqualTo("chat");
    verify(service).direct("viewer", "owner");
    verify(mongo, never()).insert(any(ChatMessage.class));
  }

  @Test
  void retryWithSameClientKeyDoesNotInsertAnotherAttachment() {
    var existing =
        new ChatMessage(
            "message", "chat", "viewer", "message-key-1", 1, "", now, false, attachment);
    when(mongo.findOne(any(Query.class), eq(ChatMessage.class))).thenReturn(existing);
    service.send("viewer", "chat", "message-key-1", "", attachment.postId());
    verify(mongo, never()).insert(any(ChatMessage.class));
    verify(mongo, never())
        .findAndModify(
            any(Query.class),
            any(Update.class),
            any(FindAndModifyOptions.class),
            eq(Conversation.class));
  }

  @Test
  void sendingPostPersistsAttachmentTogetherWithText() {
    var result =
        service.send("viewer", "chat", "message-key-1", "Điểm đón ở đâu?", attachment.postId());
    assertThat(result.text()).isEqualTo("Điểm đón ở đâu?");
    assertThat(result.ridePost()).isEqualTo(attachment);
    verify(mongo).insert(any(ChatMessage.class));
  }

  @Test
  void postFromAnotherAuthorCannotBeAttachedToThisChat() {
    when(posts.load("viewer", attachment.postId()))
        .thenReturn(new RidePostAttachmentSource.Context("another-owner", attachment));
    assertThatThrownBy(
            () -> service.send("viewer", "chat", "message-key-1", "", attachment.postId()))
        .isInstanceOf(ApiException.class);
    verify(mongo, never()).insert(any(ChatMessage.class));
  }

  @Test
  void unreadablePostCannotStartDiscussion() {
    when(posts.load("viewer", attachment.postId()))
        .thenThrow(new ApiException(HttpStatus.NOT_FOUND, "POST_NOT_FOUND", "Not found"));
    assertThatThrownBy(() -> service.discussPost("viewer", attachment.postId()))
        .isInstanceOf(ApiException.class);
    verify(service, never()).direct(anyString(), anyString());
    verify(mongo, never()).insert(any(ChatMessage.class));
  }

  @Test
  void disabledMessageRequestsCannotBeBypassedByPostDiscussion() {
    doCallRealMethod().when(service).direct("viewer", "owner");
    when(identities.allowsMessageRequests("owner")).thenReturn(false);
    assertThatThrownBy(() -> service.discussPost("viewer", attachment.postId()))
        .isInstanceOf(ApiException.class);
    verify(mongo, never()).insert(any(ChatMessage.class));
  }

  @Test
  void requesterCanSharePostWhileMessageRequestIsPending() {
    when(mongo.findById("chat", Conversation.class))
        .thenReturn(conversation(Conversation.State.REQUEST_PENDING, "viewer", 0));
    assertThat(service.send("viewer", "chat", "message-key-1", "", attachment.postId()).ridePost())
        .isEqualTo(attachment);
    verify(mongo).insert(any(ChatMessage.class));
  }

  @Test
  void pendingRequestRecipientCannotSendBeforeAccepting() {
    when(mongo.findById("chat", Conversation.class))
        .thenReturn(conversation(Conversation.State.REQUEST_PENDING, "owner", 0));
    assertThatThrownBy(
            () -> service.send("viewer", "chat", "message-key-1", "", attachment.postId()))
        .isInstanceOf(ApiException.class);
    verify(mongo, never()).insert(any(ChatMessage.class));
  }

  @Test
  void hiddenMessagesDoNotExposeJourneyAttachments() {
    when(mongo.find(any(Query.class), eq(ChatMessage.class)))
        .thenReturn(
            List.of(
                new ChatMessage(
                    "message", "chat", "viewer", "message-key-1", 1, "", now, true, attachment)));
    var result = service.messages("viewer", "chat", null, 30).getFirst();
    assertThat(result.ridePost()).isNull();
    assertThat(result.text()).isNull();
  }

  @Test
  void blankOrdinaryMessagesRemainInvalid() {
    assertThatThrownBy(() -> service.send("viewer", "chat", "message-key-1", " "))
        .isInstanceOf(ApiException.class);
    verify(mongo, never()).insert(any(ChatMessage.class));
  }
}
