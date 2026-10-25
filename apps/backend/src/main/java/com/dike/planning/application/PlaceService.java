package com.dike.planning.application;

import com.dike.identity.IdentityAccess;
import com.dike.planning.domain.PlaceSnapshot;
import com.dike.planning.infrastructure.routing.RoutingProperties;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import org.springframework.stereotype.Service;

@Service
public class PlaceService {

  private final RoutingProvider provider;
  private final PlaceSessionStore sessions;
  private final RoutingRateLimiter rateLimiter;
  private final ResolvedPlaceStore resolvedPlaces;
  private final IdentityAccess accounts;
  private final RoutingProperties properties;
  private final Clock clock;
  private final Supplier<String> identifiers;

  public PlaceService(
      RoutingProvider provider,
      PlaceSessionStore sessions,
      RoutingRateLimiter rateLimiter,
      ResolvedPlaceStore resolvedPlaces,
      IdentityAccess accounts,
      RoutingProperties properties,
      Clock clock,
      Supplier<String> identifiers) {
    this.provider = provider;
    this.sessions = sessions;
    this.rateLimiter = rateLimiter;
    this.resolvedPlaces = resolvedPlaces;
    this.accounts = accounts;
    this.properties = properties;
    this.clock = clock;
    this.identifiers = identifiers;
  }

  public record SessionView(String sessionToken, Instant expiresAt) {}

  public record SuggestionView(
      String placeRef, String mainText, String secondaryText, String displayLabel) {}

  public SessionView createSession(String userId, String clientAddress) {
    requireMember(userId);
    acquire("place-session", userId, clientAddress, 20, Duration.ofMinutes(1));
    String token = identifiers.get();
    sessions.create(userId, token, properties.placeSessionTtl());
    return new SessionView(token, clock.instant().plus(properties.placeSessionTtl()));
  }

  public List<SuggestionView> autocomplete(
      String userId,
      String sessionToken,
      String query,
      Double biasLatitude,
      Double biasLongitude,
      String clientAddress) {
    requireMember(userId);
    validateToken(sessionToken);
    String normalized = query == null ? "" : query.strip();
    if (normalized.codePointCount(0, normalized.length()) < 2
        || normalized.codePointCount(0, normalized.length()) > 200
        || (biasLatitude == null) != (biasLongitude == null)
        || (biasLatitude != null
            && (!Double.isFinite(biasLatitude)
                || !Double.isFinite(biasLongitude)
                || biasLatitude < -90
                || biasLatitude > 90
                || biasLongitude < -180
                || biasLongitude > 180))) {
      throw new InvalidPlaceRequestException();
    }
    acquire("place-autocomplete", userId, clientAddress, 60, Duration.ofMinutes(1));
    List<RoutingProvider.PlaceSuggestion> results =
        provider.autocomplete(normalized, sessionToken, biasLatitude, biasLongitude);
    Map<String, String> references = new LinkedHashMap<>();
    List<SuggestionView> response =
        results.stream()
            .limit(10)
            .map(
                value -> {
                  String reference = identifiers.get();
                  references.put(reference, value.providerPlaceId());
                  return new SuggestionView(
                      reference, value.mainText(), value.secondaryText(), value.displayLabel());
                })
            .toList();
    if (!sessions.saveSuggestions(userId, sessionToken, references)) {
      throw new PlaceSessionUnavailableException();
    }
    return response;
  }

  public PlaceSnapshot resolve(
      String userId, String sessionToken, String placeReference, String clientAddress) {
    requireMember(userId);
    validateToken(sessionToken);
    validateToken(placeReference);
    acquire("place-resolve", userId, clientAddress, 20, Duration.ofMinutes(1));
    String providerId =
        sessions
            .consume(userId, sessionToken, placeReference)
            .orElseThrow(PlaceSessionUnavailableException::new);
    PlaceSnapshot place = provider.resolve(providerId, sessionToken, clock.instant());
    resolvedPlaces.save(userId, placeReference, place, properties.cacheTtl());
    return place;
  }

  public record ResolvedView(String placeRef, PlaceSnapshot place) {}

  public ResolvedView reverse(
      String userId, double latitude, double longitude, String clientAddress) {
    requireMember(userId);
    if (!Double.isFinite(latitude)
        || !Double.isFinite(longitude)
        || latitude < -85
        || latitude > 85
        || longitude < -180
        || longitude > 180) {
      throw new InvalidPlaceRequestException();
    }
    acquire("place-reverse", userId, clientAddress, 30, Duration.ofMinutes(1));
    PlaceSnapshot place = provider.reverse(latitude, longitude, clock.instant());
    String reference = identifiers.get();
    resolvedPlaces.save(userId, reference, place, properties.cacheTtl());
    return new ResolvedView(reference, place);
  }

  private void acquire(
      String action, String userId, String clientAddress, long limit, Duration window) {
    if (!rateLimiter.tryAcquire(action, userId, clientAddress, limit, window)) {
      throw new PlaceRateLimitedException();
    }
  }

  private void requireMember(String userId) {
    if (!accounts.require(userId).member()) {
      throw new PlaceAccessDeniedException();
    }
  }

  private void validateToken(String value) {
    if (value == null || !value.matches("[A-Za-z0-9_-]{8,100}")) {
      throw new InvalidPlaceRequestException();
    }
  }

  public static final class InvalidPlaceRequestException extends RuntimeException {}

  public static final class PlaceSessionUnavailableException extends RuntimeException {}

  public static final class PlaceRateLimitedException extends RuntimeException {}

  public static final class PlaceAccessDeniedException extends RuntimeException {}
}
