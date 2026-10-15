package com.dike.planning.application;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.dike.planning.PostAccounts;
import com.dike.planning.domain.*;
import com.dike.shared.api.ApiException;
import java.time.*;
import java.util.*;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

class RideDiscoveryServiceTest {
  final PlanningStore routes = mock(PlanningStore.class);
  final PostStore store = mock(PostStore.class);
  final PostService posts = mock(PostService.class);
  final PostAccounts accounts = mock(PostAccounts.class);
  final MongoTemplate mongo = mock(MongoTemplate.class);
  final Instant now = Instant.parse("2026-10-15T00:00:00Z");
  final RideDiscoveryService service =
      new RideDiscoveryService(
          routes, store, posts, accounts, mongo, Clock.fixed(now, ZoneOffset.UTC));
  final List<RoutePoint> road =
      List.of(new RoutePoint(0, 0), new RoutePoint(.1, 0), new RoutePoint(.2, 0));
  RidePost candidate;

  @BeforeEach
  void setup() {
    when(accounts.active("viewer")).thenReturn(true);
    when(routes.route("own")).thenReturn(Optional.of(route("viewer", road)));
    candidate =
        new RidePost(
            "post",
            "owner",
            RidePost.Type.NEED_RIDE,
            "source",
            0,
            RidePost.Status.OPEN,
            "PUBLIC",
            null,
            "A",
            "B",
            "CAR",
            "saved",
            now.plusSeconds(3600),
            now.plusSeconds(7200),
            "",
            0,
            0,
            null,
            now);
    when(store.find("post")).thenAnswer(i -> Optional.of(candidate));
    when(mongo.find(any(Query.class), eq(Document.class), eq("ride_posts")))
        .thenReturn(List.of(new Document("_id", "post")));
    when(routes.route("saved"))
        .thenReturn(
            Optional.of(
                route("owner", List.of(new RoutePoint(.05, .02), new RoutePoint(.15, .02)))));
    when(posts.readable(eq("viewer"), any())).thenReturn(true);
    var view = mock(PostService.View.class);
    when(view.id()).thenReturn("post");
    when(view.status()).thenReturn("OPEN");
    when(view.remainingSeats()).thenReturn(1);
    when(posts.detail("viewer", "post")).thenReturn(view);
  }

  RouteSnapshot route(String owner, List<RoutePoint> points) {
    var start = points.getFirst();
    var end = points.getLast();
    return new RouteSnapshot(
        "route",
        owner,
        "GOONG",
        "provider-route",
        VehicleMode.CAR,
        new PlaceSnapshot("GOONG", "start", "A", "A", start.longitude(), start.latitude(), now),
        new PlaceSnapshot("GOONG", "end", "B", "B", end.longitude(), end.latitude(), now),
        10000,
        600,
        points,
        now,
        now.plusSeconds(86400),
        0);
  }

  RideDiscoveryService.Input input(String role) {
    return new RideDiscoveryService.Input("own", role, now, 1);
  }

  @Test
  void findsIntermediatePickupAndDestinationWithinFiveKmAndOneHour() {
    var result = service.search("viewer", input("driver"));
    assertThat(result.items()).hasSize(1);
    assertThat(result.items().getFirst().pickupDistanceMeters()).isBetween(2200L, 2250L);
    assertThat(result.items().getFirst().timeDifferenceMinutes()).isEqualTo(60);
    verify(mongo)
        .find(
            argThat(q -> q.getQueryObject().get("type").equals("NEED_RIDE") && q.getLimit() == 500),
            eq(Document.class),
            eq("ride_posts"));
  }

  @Test
  void rejectsReverseDirectionEvenWhenBothPointsAreOnTheRoute() {
    when(routes.route("saved"))
        .thenReturn(
            Optional.of(route("owner", List.of(new RoutePoint(.15, 0), new RoutePoint(.05, 0)))));
    assertThat(service.search("viewer", input("driver")).items()).isEmpty();
  }

  @Test
  void respectsFiveKmThresholdOnBothEnds() {
    for (int meters : List.of(4999, 5001)) {
      when(routes.route("saved"))
          .thenReturn(
              Optional.of(
                  route(
                      "owner",
                      List.of(
                          new RoutePoint(.05, meters / 111320.0),
                          new RoutePoint(.15, meters / 111320.0)))));
      assertThat(service.search("viewer", input("driver")).items()).hasSize(meters == 4999 ? 1 : 0);
    }
  }

  @Test
  void cannotSearchWithAnotherMembersRoute() {
    when(routes.route("own")).thenReturn(Optional.of(route("someone-else", road)));
    assertThatThrownBy(() -> service.search("viewer", input("driver")))
        .isInstanceOf(ApiException.class);
    verifyNoInteractions(mongo, posts, store);
  }

  @Test
  void filtersHiddenFriendsOnlyAndBlockedPostsBeforeReadingGeometry() {
    when(posts.readable("viewer", candidate)).thenReturn(false);
    assertThat(service.search("viewer", input("driver")).items()).isEmpty();
    verify(routes, never()).route("saved");
    verify(posts, never()).detail(any(), any());
  }

  @Test
  void passengerSearchesOffersAndRequiresEnoughSeats() {
    candidate =
        new RidePost(
            "post",
            "owner",
            RidePost.Type.OFFER_RIDE,
            "source",
            0,
            RidePost.Status.OPEN,
            "PUBLIC",
            null,
            "A",
            "B",
            "CAR",
            "saved",
            now.plusSeconds(3600),
            now.plusSeconds(7200),
            "",
            0,
            0,
            null,
            now);
    when(routes.route("own"))
        .thenReturn(
            Optional.of(
                route("viewer", List.of(new RoutePoint(.05, .02), new RoutePoint(.15, .02)))));
    when(routes.route("saved")).thenReturn(Optional.of(route("owner", road)));
    assertThat(service.search("viewer", input("passenger")).items()).hasSize(1);
    assertThat(
            service
                .search("viewer", new RideDiscoveryService.Input("own", "passenger", now, 2))
                .items())
        .isEmpty();
  }

  @Test
  void excludesResultsOutsideTimeWindowEvenIfReturnedByStorage() {
    assertThat(
            service
                .search(
                    "viewer",
                    new RideDiscoveryService.Input("own", "driver", now.minusSeconds(1), 1))
                .items())
        .isEmpty();
  }
}
