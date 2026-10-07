package com.dike.planning.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.dike.identity.IdentityAccess;
import com.dike.planning.domain.PlaceSnapshot;
import com.dike.planning.domain.RoutePoint;
import com.dike.planning.domain.RouteSnapshot;
import com.dike.planning.domain.VehicleMode;
import com.dike.planning.infrastructure.redis.RedisRouteCache;
import com.dike.planning.infrastructure.routing.ContributionProperties;
import com.dike.planning.infrastructure.routing.RoutingProperties;
import java.math.BigDecimal;
import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.mock.env.MockEnvironment;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@Testcontainers(disabledWithoutDocker = true)
class RoutePlanningServiceCachingIT {

  @Container
  private static final GenericContainer<?> REDIS =
      new GenericContainer<>(DockerImageName.parse("redis:8.10.2-alpine3.23"))
          .withExposedPorts(6379);

  private static LettuceConnectionFactory connectionFactory;
  private static StringRedisTemplate redis;
  private static RedisRouteCache cache;

  private RoutingProvider provider;
  private RoutePlanningService service;
  private PlanningStore store;
  private IdentityAccess accounts;
  private ResolvedPlaceStore places;

  @BeforeAll
  static void connect() {
    connectionFactory = new LettuceConnectionFactory(REDIS.getHost(), REDIS.getFirstMappedPort());
    connectionFactory.afterPropertiesSet();
    redis = new StringRedisTemplate(connectionFactory);
    redis.afterPropertiesSet();

    RoutingProperties properties =
        new RoutingProperties(
            "goong",
            "key",
            URI.create("https://rsapi.goong.io"),
            Duration.ofSeconds(2),
            Duration.ofSeconds(5),
            Duration.ofMinutes(5),
            Duration.ofMinutes(10),
            Duration.ofMinutes(15),
            "test-cache-secret",
            false);

    cache =
        new RedisRouteCache(
            redis, new MockEnvironment().withProperty("dike.environment", "test"), properties);
  }

  @AfterAll
  static void close() {
    if (connectionFactory != null) connectionFactory.destroy();
  }

  @BeforeEach
  void reset() {
    redis.getConnectionFactory().getConnection().serverCommands().flushAll();

    provider = mock(RoutingProvider.class);
    store = mock(PlanningStore.class);
    accounts = mock(IdentityAccess.class);
    places = mock(ResolvedPlaceStore.class);

    RoutingProperties routing =
        new RoutingProperties(
            "goong",
            "key",
            URI.create("http://localhost"),
            Duration.ofSeconds(1),
            Duration.ofSeconds(1),
            Duration.ofMinutes(1),
            Duration.ofMinutes(5),
            Duration.ofMinutes(10),
            "secret",
            true);
    ContributionProperties contribution =
        new ContributionProperties(
            true, BigDecimal.ONE, BigDecimal.ONE, BigDecimal.ONE, BigDecimal.ONE, BigDecimal.ONE);

    service =
        new RoutePlanningService(
            provider,
            store,
            cache,
            places,
            accounts,
            routing,
            contribution,
            Clock.fixed(Instant.parse("2026-10-07T00:00:00Z"), ZoneId.of("UTC")),
            () -> "route-123");

    when(accounts.require("user-1"))
        .thenReturn(new IdentityAccess.Access("user-1", true, true, false, null, 0L));
  }

  @Test
  void identicalRequestsReturnCacheHit() {
    Instant now = Instant.parse("2026-10-07T00:00:00Z");
    PlaceSnapshot origin = new PlaceSnapshot("GOONG", "p1", "Origin", "O1", 106.0, 10.0, now);
    PlaceSnapshot destination = new PlaceSnapshot("GOONG", "p2", "Dest", "D1", 106.1, 10.1, now);

    when(places.find("user-1", "ref-1")).thenReturn(Optional.of(origin));
    when(places.find("user-1", "ref-2")).thenReturn(Optional.of(destination));

    RoutingProvider.RouteResult routeResult =
        new RoutingProvider.RouteResult(
            "GOONG",
            "route-abc",
            1500,
            300,
            List.of(new RoutePoint(10.0, 106.0), new RoutePoint(10.1, 106.1)));

    when(provider.route(origin, destination, VehicleMode.MOTORBIKE)).thenReturn(routeResult);
    when(store.insertRoute(any())).thenAnswer(inv -> inv.getArgument(0));

    // First request - should miss cache and call provider
    RouteSnapshot first = service.route("user-1", "ref-1", "ref-2", VehicleMode.MOTORBIKE);
    assertThat(first.providerRouteId()).isEqualTo("route-abc");

    // Second request - should hit cache
    RouteSnapshot second = service.route("user-1", "ref-1", "ref-2", VehicleMode.MOTORBIKE);
    assertThat(second.providerRouteId()).isEqualTo("route-abc");

    // Verify provider was only called ONCE
    verify(provider, times(1)).route(any(), any(), any());
  }
}
