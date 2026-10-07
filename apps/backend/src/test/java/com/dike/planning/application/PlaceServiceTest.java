package com.dike.planning.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.dike.identity.IdentityAccess;
import com.dike.planning.domain.PlaceSnapshot;
import com.dike.planning.domain.VehicleMode;
import com.dike.planning.infrastructure.routing.RoutingProperties;
import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class PlaceServiceTest {

  private static final Instant NOW = Instant.parse("2026-10-07T00:00:00Z");
  private MemorySessions sessions;
  private PlaceService service;

  @BeforeEach
  void setUp() {
    var accounts = mock(IdentityAccess.class);
    when(accounts.require("user-1"))
        .thenReturn(
            new IdentityAccess.Access(
                "user-1", true, false, false, IdentityAccess.DriverEvidence.NONE, 0));
    sessions = new MemorySessions();
    AtomicInteger sequence = new AtomicInteger();
    service =
        new PlaceService(
            provider(),
            sessions,
            (action, user, address, limit, window) -> true,
            new ResolvedPlaceStore() {
              @Override
              public void save(String owner, String reference, PlaceSnapshot place, Duration ttl) {
                resolved.put(owner + ":" + reference, place);
              }

              @Override
              public Optional<PlaceSnapshot> find(String owner, String reference) {
                return Optional.ofNullable(resolved.get(owner + ":" + reference));
              }
            },
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
            Clock.fixed(NOW, ZoneOffset.UTC),
            () -> "generated-" + sequence.incrementAndGet());
  }

  private final Map<String, PlaceSnapshot> resolved = new HashMap<>();

  @Test
  void hidesProviderIdBehindOneUseReference() {
    var session = service.createSession("user-1", "127.0.0.1");
    var suggestion =
        service
            .autocomplete("user-1", session.sessionToken(), "school", null, null, "127.0.0.1")
            .getFirst();

    assertThat(suggestion.placeRef()).startsWith("generated-");
    assertThat(suggestion.placeRef()).doesNotContain("provider-secret-id");
    PlaceSnapshot resolved =
        service.resolve("user-1", session.sessionToken(), suggestion.placeRef(), "127.0.0.1");
    assertThat(resolved.providerPlaceId()).isEqualTo("provider-secret-id");
    assertThatThrownBy(
            () ->
                service.resolve(
                    "user-1", session.sessionToken(), suggestion.placeRef(), "127.0.0.1"))
        .isInstanceOf(PlaceService.PlaceSessionUnavailableException.class);
  }

  @Test
  void rejectsInvalidQueryWithoutCallingProvider() {
    var session = service.createSession("user-1", "127.0.0.1");
    assertThatThrownBy(
            () ->
                service.autocomplete(
                    "user-1", session.sessionToken(), "x", null, null, "127.0.0.1"))
        .isInstanceOf(PlaceService.InvalidPlaceRequestException.class);
  }

  private RoutingProvider provider() {
    return new RoutingProvider() {
      @Override
      public List<PlaceSuggestion> autocomplete(
          String query, String sessionToken, Double biasLatitude, Double biasLongitude) {
        return List.of(
            new PlaceSuggestion("provider-secret-id", "School", "District", "School, District"));
      }

      @Override
      public PlaceSnapshot resolve(
          String providerPlaceId, String sessionToken, Instant resolvedAt) {
        return new PlaceSnapshot(
            "FAKE", providerPlaceId, "School", "District", 106.7, 10.77, resolvedAt);
      }

      @Override
      public RouteResult route(
          PlaceSnapshot origin, PlaceSnapshot destination, VehicleMode vehicleMode) {
        throw new UnsupportedOperationException();
      }
    };
  }

  private static final class MemorySessions implements PlaceSessionStore {
    private final Map<String, String> owners = new HashMap<>();
    private final Map<String, Map<String, String>> references = new HashMap<>();
    private final Set<String> used = new java.util.HashSet<>();

    @Override
    public void create(String ownerUserId, String sessionToken, Duration ttl) {
      owners.put(sessionToken, ownerUserId);
    }

    @Override
    public boolean saveSuggestions(
        String ownerUserId, String sessionToken, Map<String, String> values) {
      if (!ownerUserId.equals(owners.get(sessionToken)) || used.contains(sessionToken))
        return false;
      references.computeIfAbsent(sessionToken, ignored -> new HashMap<>()).putAll(values);
      return true;
    }

    @Override
    public Optional<String> consume(
        String ownerUserId, String sessionToken, String placeReference) {
      if (!ownerUserId.equals(owners.get(sessionToken)) || !used.add(sessionToken)) {
        return Optional.empty();
      }
      return Optional.ofNullable(
          references.getOrDefault(sessionToken, Map.of()).get(placeReference));
    }
  }
}
