package com.dike.planning.application;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.dike.messaging.*;
import com.dike.shared.api.ApiException;
import java.time.*;
import java.util.Date;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.convert.MongoConverter;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.http.HttpStatus;

class RidePostPickupResponseTest {
  final MongoTemplate mongo = mock(MongoTemplate.class);
  final PostService posts = mock(PostService.class);
  final NotificationPublisher notifications = mock(NotificationPublisher.class);
  final ConfirmedConversationPublisher conversations = mock(ConfirmedConversationPublisher.class);
  final PickupCompatibilityService pickups = mock(PickupCompatibilityService.class);
  final Instant now = Instant.parse("2026-10-14T00:00:00Z");
  final RidePostResponseService responses =
      new RidePostResponseService(
          mongo,
          posts,
          notifications,
          conversations,
          mock(com.dike.planning.PostAccounts.class),
          Clock.fixed(now, ZoneOffset.UTC),
          pickups);

  @Test
  void offerCannotBeRequestedWithoutServerVerifiedPickupEvidence() {
    when(mongo.findById("post", Document.class, "ride_posts"))
        .thenReturn(
            new Document("ownerId", "driver")
                .append("status", "OPEN")
                .append("type", "OFFER_RIDE"));
    when(pickups.require("passenger", "post", null))
        .thenThrow(new ApiException(HttpStatus.BAD_REQUEST, "PICKUP_CHECK_REQUIRED", "Required"));
    assertThatThrownBy(() -> responses.create("passenger", "post", "hello", null))
        .isInstanceOf(ApiException.class);
    verify(mongo, never()).insert(any(Document.class), eq("ride_post_responses"));
    verifyNoInteractions(notifications, conversations);
  }

  @Test
  void outgoingRequestPersistsPointAndDetourEvidenceButDoesNotAutoAccept() {
    when(mongo.findById("post", Document.class, "ride_posts"))
        .thenReturn(
            new Document("ownerId", "driver")
                .append("status", "OPEN")
                .append("type", "OFFER_RIDE"));
    var check = mock(PickupCompatibilityService.View.class);
    when(check.id()).thenReturn("check");
    when(pickups.require("passenger", "post", "check")).thenReturn(check);
    var converter = mock(MongoConverter.class);
    when(mongo.getConverter()).thenReturn(converter);
    when(converter.read(eq(PickupCompatibilityService.View.class), any(Document.class)))
        .thenReturn(check);
    var result = responses.create("passenger", "post", "hello", "check");
    assertThat(result.status()).isEqualTo("PENDING");
    assertThat(result.pickupCheck()).isSameAs(check);
    verify(converter).write(eq(check), any(Document.class));
    verifyNoInteractions(conversations);
  }

  @Test
  void driverCannotAcceptStalePickupResultOrChangedTrip() {
    when(mongo.findById("request", Document.class, "ride_post_responses"))
        .thenReturn(
            new Document("ownerId", "driver")
                .append("requesterId", "passenger")
                .append("postId", "post")
                .append("pickupCheckId", "expired")
                .append("action", "REQUEST_RIDE")
                .append("status", "PENDING")
                .append("version", 0L)
                .append("createdAt", Date.from(now)));
    when(pickups.require("passenger", "post", "expired"))
        .thenThrow(new ApiException(HttpStatus.CONFLICT, "PICKUP_CHECK_CHANGED", "Changed"));
    assertThatThrownBy(() -> responses.decide("driver", "request", 0, "ACCEPTED"))
        .isInstanceOf(ApiException.class);
    verify(mongo, never())
        .updateFirst(any(Query.class), any(Update.class), eq("ride_post_responses"));
    verifyNoInteractions(notifications, conversations);
    assertThatThrownBy(() -> responses.decide("attacker", "request", 0, "ACCEPTED"))
        .isInstanceOf(ApiException.class);
    verify(pickups, times(1)).require("passenger", "post", "expired");
  }
}
