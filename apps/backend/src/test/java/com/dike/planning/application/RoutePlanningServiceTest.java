package com.dike.planning.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.dike.identity.IdentityAccess;
import com.dike.planning.domain.PlaceSnapshot;
import com.dike.planning.domain.RoutePoint;
import com.dike.planning.domain.RouteSnapshot;
import com.dike.planning.domain.VehicleMode;
import com.dike.planning.infrastructure.routing.ContributionProperties;
import com.dike.planning.infrastructure.routing.RoutingProperties;
import java.math.BigDecimal;
import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class RoutePlanningServiceTest {

  private static final Instant NOW = Instant.parse("2026-10-07T00:00:00Z");
  private PlanningStore store;
  private RoutePlanningService service;

  @BeforeEach
  void setUp() {
    store = mock(PlanningStore.class);
    when(store.insertRoute(any())).thenAnswer(call -> call.getArgument(0));
    IdentityAccess accounts = mock(IdentityAccess.class);
    when(accounts.require("user-1"))
        .thenReturn(
            new IdentityAccess.Access(
                "user-1", true, true, false, IdentityAccess.DriverEvidence.NONE, 0));
    PlaceSnapshot origin = place("origin", 106.70, 10.77);
    PlaceSnapshot destination = place("destination", 106.71, 10.78);
    ResolvedPlaceStore places = mock(ResolvedPlaceStore.class);
    when(places.find("user-1", "origin-ref")).thenReturn(Optional.of(origin));
    when(places.find("user-1", "destination-ref")).thenReturn(Optional.of(destination));
    RoutingProvider provider = mock(RoutingProvider.class);
    when(provider.route(origin, destination, VehicleMode.MOTORBIKE))
        .thenReturn(
            new RoutingProvider.RouteResult(
                "FAKE",
                "provider-route",
                10_000,
                1_200,
                List.of(
                    new RoutePoint(origin.longitude(), origin.latitude()),
                    new RoutePoint(destination.longitude(), destination.latitude()))));
    AtomicInteger sequence = new AtomicInteger();
    service =
        new RoutePlanningService(
            provider,
            store,
            new RouteCache() {
              @Override
              public Optional<RoutingProvider.RouteResult> find(
                  PlaceSnapshot origin, PlaceSnapshot destination, VehicleMode mode) {
                return Optional.empty();
              }

              @Override
              public void put(
                  PlaceSnapshot origin,
                  PlaceSnapshot destination,
                  VehicleMode mode,
                  RoutingProvider.RouteResult route,
                  Duration ttl) {}
            },
            places,
            accounts,
            new RoutingProperties(
                "fake",
                "test-key",
                URI.create("https://rsapi.goong.io"),
                Duration.ofSeconds(2),
                Duration.ofSeconds(5),
                Duration.ofMinutes(5),
                Duration.ofMinutes(10),
                Duration.ofMinutes(15),
                "test-cache-secret",
                false),
            new ContributionProperties(
                true,
                BigDecimal.valueOf(25_000),
                BigDecimal.valueOf(2),
                BigDecimal.valueOf(8),
                BigDecimal.ZERO,
                BigDecimal.valueOf(10_000)),
            Clock.fixed(NOW, ZoneOffset.UTC),
            () -> "generated-" + sequence.incrementAndGet());
  }

  @Test
  void storesRouteAndRoundsEstimateToNearestThousand() {
    RouteSnapshot route =
        service.route("user-1", "origin-ref", "destination-ref", VehicleMode.MOTORBIKE);
    when(store.route(route.id())).thenReturn(Optional.of(route));

    var estimate = service.estimate("user-1", route.id(), 10_000, 1);

    assertThat(route.distanceMeters()).isEqualTo(10_000);
    assertThat(estimate.suggestedPerKmVnd()).isEqualTo(250);
    assertThat(estimate.amountVnd()).isEqualTo(3_000);
    assertThat(estimate.expiresAt()).isEqualTo(route.expiresAt());
  }

  @Test
  void rejectsAnotherOwnersRouteAsNotFound() {
    RouteSnapshot route =
        service.route("user-1", "origin-ref", "destination-ref", VehicleMode.MOTORBIKE);
    RouteSnapshot anotherOwner =
        new RouteSnapshot(
            route.id(),
            "user-2",
            route.provider(),
            route.providerRouteId(),
            route.vehicleMode(),
            route.origin(),
            route.destination(),
            route.distanceMeters(),
            route.durationSeconds(),
            route.geometry(),
            route.calculatedAt(),
            route.expiresAt(),
            route.version());
    when(store.route(route.id())).thenReturn(Optional.of(anotherOwner));

    assertThatThrownBy(() -> service.get("user-1", route.id()))
        .isInstanceOf(RoutePlanningService.RouteNotFoundException.class);
  }

  private PlaceSnapshot place(String id, double longitude, double latitude) {
    return new PlaceSnapshot("FAKE", id, id, "District", longitude, latitude, NOW);
  }
}
