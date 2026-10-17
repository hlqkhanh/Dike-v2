package com.dike.planning.application;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.dike.messaging.*;
import com.dike.shared.api.ApiException;
import com.mongodb.client.result.UpdateResult;
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
  void sameRouteRequestCanBeSentWithoutPickupEvidenceOrMessage() {
    when(mongo.findById("post", Document.class, "ride_posts"))
        .thenReturn(
            new Document("ownerId", "driver")
                .append("status", "OPEN")
                .append("type", "OFFER_RIDE"));
    var result = responses.create("passenger", "post", null, null);
    assertThat(result.status()).isEqualTo("PENDING");
    assertThat(result.message()).isEmpty();
    assertThat(result.pickupCheck()).isNull();
    verify(pickups).require("passenger", "post", null);
    verifyNoInteractions(conversations);
  }

  @Test
  void unavailableSameRouteCannotBeRequested() {
    when(mongo.findById("post", Document.class, "ride_posts"))
        .thenReturn(
            new Document("ownerId", "driver")
                .append("status", "OPEN")
                .append("type", "OFFER_RIDE"));
    when(pickups.require("passenger", "post", null))
        .thenThrow(new ApiException(HttpStatus.BAD_REQUEST, "TRIP_NOT_AVAILABLE", "Unavailable"));
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

  @Test
  void acceptedRequestProgressCanOnlyBeAdvancedByTheDriver() {
    var accepted =
        new Document("_id", "request")
            .append("ownerId", "driver")
            .append("requesterId", "passenger")
            .append("postId", "post")
            .append("action", "REQUEST_RIDE")
            .append("status", "ACCEPTED")
            .append("version", 1L)
            .append("message", "")
            .append("createdAt", Date.from(now))
            .append("updatedAt", Date.from(now));
    var started = new Document(accepted);
    started.put("status", "DRIVER_STARTED");
    started.put("version", 2L);
    when(mongo.findById("request", Document.class, "ride_post_responses"))
        .thenReturn(accepted, started);
    when(mongo.updateFirst(any(Query.class), any(Update.class), eq("ride_post_responses")))
        .thenReturn(UpdateResult.acknowledged(1, 1L, null));

    var result = responses.decide("driver", "request", 1, "DRIVER_STARTED");

    assertThat(result.status()).isEqualTo("DRIVER_STARTED");
    assertThat(result.version()).isEqualTo(2L);
    verify(notifications)
        .notify(
            eq("passenger"),
            eq("RIDE_POST_RESPONSE_DRIVER_STARTED"),
            anyString(),
            anyString(),
            anyMap());
    verifyNoInteractions(conversations);
  }

  @Test
  void passengerCannotAdvanceAnAcceptedRequest() {
    when(mongo.findById("request", Document.class, "ride_post_responses"))
        .thenReturn(
            new Document("ownerId", "driver")
                .append("requesterId", "passenger")
                .append("postId", "post")
                .append("action", "REQUEST_RIDE")
                .append("status", "ACCEPTED")
                .append("version", 1L));

    assertThatThrownBy(() -> responses.decide("passenger", "request", 1, "DRIVER_STARTED"))
        .isInstanceOf(ApiException.class);
    verify(mongo, never())
        .updateFirst(any(Query.class), any(Update.class), eq("ride_post_responses"));
  }
}
