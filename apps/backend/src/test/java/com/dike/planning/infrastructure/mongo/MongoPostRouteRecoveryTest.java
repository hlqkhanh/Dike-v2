package com.dike.planning.infrastructure.mongo;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.dike.planning.application.*;
import com.dike.planning.domain.*;
import com.dike.planning.infrastructure.routing.RoutingProperties;
import com.dike.shared.api.ApiException;
import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.*;
import org.springframework.data.mongodb.core.query.*;

class MongoPostRouteRecoveryTest {
  final MongoTemplate mongo = mock(MongoTemplate.class);
  final PlanningStore routes = mock(PlanningStore.class);
  final RoutingProvider provider = mock(RoutingProvider.class);
  final RouteCache cache = mock(RouteCache.class);
  final RoutingProperties config = mock(RoutingProperties.class);
  final Instant now = Instant.parse("2026-10-14T00:00:00Z");
  final MongoPostRouteRecovery recovery =
      new MongoPostRouteRecovery(
          mongo, routes, provider, cache, config, Clock.fixed(now, ZoneOffset.UTC));

  RidePost post() {
    return new RidePost(
        "post",
        "owner",
        RidePost.Type.OFFER_RIDE,
        "trip",
        0,
        RidePost.Status.OPEN,
        "PUBLIC",
        null,
        "Hà Đông, Hà Nội",
        "Keangnam, Hà Nội",
        "CAR",
        null,
        now.plusSeconds(3600),
        now.plusSeconds(7200),
        "",
        0,
        0,
        null,
        now);
  }

  void lease() {
    when(mongo.findAndModify(
            any(Query.class),
            any(Update.class),
            any(FindAndModifyOptions.class),
            eq(Document.class),
            eq("post_route_leases")))
        .thenReturn(new Document("token", "lease"));
    when(config.estimateTtl()).thenReturn(Duration.ofHours(1));
    when(config.cacheTtl()).thenReturn(Duration.ofHours(1));
  }

  @Test
  void calculatesOnceFromPreciseCoordinatesAndPersistsForEveryViewer() {
    lease();
    var saved = new AtomicReference<RouteSnapshot>();
    when(routes.route(anyString())).thenAnswer(call -> Optional.ofNullable(saved.get()));
    when(routes.insertRoute(any()))
        .thenAnswer(
            call -> {
              saved.set(call.getArgument(0));
              return saved.get();
            });
    when(mongo.findById("post", Document.class, "ride_posts"))
        .thenReturn(
            new Document()
                .append("origin", new Document("longitude", 105.77).append("latitude", 20.98))
                .append(
                    "destination", new Document("longitude", 105.78).append("latitude", 21.01)));
    var result =
        new RoutingProvider.RouteResult(
            "GOONG",
            null,
            4200,
            600,
            List.of(new RoutePoint(105.77, 20.98), new RoutePoint(105.78, 21.01)));
    when(provider.route(any(), any(), eq(VehicleMode.CAR))).thenReturn(result);

    var first = recovery.recover(post());
    assertThat(first.geometry()).isEqualTo(result.geometry());
    assertThat(first.ownerUserId()).isEqualTo("owner");
    assertThat(recovery.recover(post())).isSameAs(first);
    verify(provider, times(1)).route(any(), any(), eq(VehicleMode.CAR));
    verify(provider, never()).autocomplete(anyString(), anyString(), any(), any());
    verify(routes, times(1)).insertRoute(any());
    verify(mongo).remove(any(Query.class), eq("post_route_leases"));
  }

  @Test
  void concurrentViewerDoesNotMakeAnotherProviderCall() {
    when(mongo.findAndModify(
            any(Query.class),
            any(Update.class),
            any(FindAndModifyOptions.class),
            eq(Document.class),
            eq("post_route_leases")))
        .thenThrow(new DuplicateKeyException("Lease already held"));
    assertThatThrownBy(() -> recovery.recover(post())).isInstanceOf(ApiException.class);
    verifyNoInteractions(provider);
  }

  @Test
  void legacyAddressIsResolvedAndProviderFailureLeavesNoSavedRoute() {
    lease();
    when(provider.autocomplete(anyString(), anyString(), any(), any()))
        .thenReturn(
            List.of(new RoutingProvider.PlaceSuggestion("place", "Address", "Hà Nội", "Address")));
    when(provider.resolve(eq("place"), anyString(), eq(now)))
        .thenReturn(new PlaceSnapshot("GOONG", "place", "Address", "Hà Nội", 105.77, 20.98, now));
    when(provider.route(any(), any(), any()))
        .thenThrow(new RoutingProviderException("ROUTING_UNAVAILABLE", "Unavailable"));
    assertThatThrownBy(() -> recovery.recover(post())).isInstanceOf(ApiException.class);
    verify(provider, times(2)).resolve(eq("place"), anyString(), eq(now));
    verify(routes, never()).insertRoute(any());
    verify(mongo).remove(any(Query.class), eq("post_route_leases"));
  }
}
