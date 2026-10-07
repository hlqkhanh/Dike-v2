package com.dike.planning.application;

import com.dike.identity.IdentityAccess;
import com.dike.planning.domain.ContributionEstimate;
import com.dike.planning.domain.PlaceSnapshot;
import com.dike.planning.domain.RouteSnapshot;
import com.dike.planning.domain.VehicleMode;
import com.dike.planning.infrastructure.routing.ContributionProperties;
import com.dike.planning.infrastructure.routing.RoutingProperties;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.util.function.Supplier;
import org.springframework.stereotype.Service;

@Service
public class RoutePlanningService {

  private static final BigDecimal ONE_HUNDRED = BigDecimal.valueOf(100);
  private static final BigDecimal ONE_THOUSAND = BigDecimal.valueOf(1000);

  private final RoutingProvider provider;
  private final PlanningStore store;
  private final RouteCache cache;
  private final ResolvedPlaceStore places;
  private final IdentityAccess accounts;
  private final RoutingProperties routing;
  private final ContributionProperties contribution;
  private final Clock clock;
  private final Supplier<String> identifiers;

  public RoutePlanningService(
      RoutingProvider provider,
      PlanningStore store,
      RouteCache cache,
      ResolvedPlaceStore places,
      IdentityAccess accounts,
      RoutingProperties routing,
      ContributionProperties contribution,
      Clock clock,
      Supplier<String> identifiers) {
    this.provider = provider;
    this.store = store;
    this.cache = cache;
    this.places = places;
    this.accounts = accounts;
    this.routing = routing;
    this.contribution = contribution;
    this.clock = clock;
    this.identifiers = identifiers;
  }

  public RouteSnapshot route(
      String ownerUserId, String originPlaceRef, String destinationPlaceRef, VehicleMode mode) {
    requireRoutingAccess(ownerUserId);
    if (mode == null) throw new InvalidRouteRequestException();
    PlaceSnapshot origin = place(ownerUserId, originPlaceRef);
    PlaceSnapshot destination = place(ownerUserId, destinationPlaceRef);
    RoutingProvider.RouteResult result = cachedRoute(origin, destination, mode);
    Instant now = clock.instant();
    return store.insertRoute(
        new RouteSnapshot(
            identifiers.get(),
            ownerUserId,
            result.provider(),
            result.providerRouteId(),
            mode,
            origin,
            destination,
            result.distanceMeters(),
            result.durationSeconds(),
            result.geometry(),
            now,
            now.plus(routing.estimateTtl()),
            0));
  }

  private RoutingProvider.RouteResult cachedRoute(
      PlaceSnapshot origin, PlaceSnapshot destination, VehicleMode mode) {
    try {
      var cached = cache.find(origin, destination, mode);
      if (cached.isPresent()) return cached.get();
    } catch (RuntimeException ignored) {
      // Cache is an optimization; provider remains authoritative.
    }
    RoutingProvider.RouteResult result = provider.route(origin, destination, mode);
    try {
      cache.put(origin, destination, mode, result, routing.cacheTtl());
    } catch (RuntimeException ignored) {
      // A cache outage must not turn a valid provider response into a failure.
    }
    return result;
  }

  public RouteSnapshot get(String ownerUserId, String routeId) {
    requireRoutingAccess(ownerUserId);
    return store
        .route(routeId)
        .filter(value -> value.ownerUserId().equals(ownerUserId))
        .orElseThrow(RouteNotFoundException::new);
  }

  public ContributionEstimate estimate(
      String ownerUserId, String routeId, long sharedDistanceMeters, int passengerSeats) {
    RouteSnapshot route = get(ownerUserId, routeId);
    Instant now = clock.instant();
    if (!route.expiresAt().isAfter(now)) throw new EstimateExpiredException();
    if (sharedDistanceMeters <= 0
        || sharedDistanceMeters > route.distanceMeters()
        || passengerSeats < 0
        || passengerSeats > 7) {
      throw new InvalidRouteRequestException();
    }
    BigDecimal consumption =
        route.vehicleMode() == VehicleMode.CAR
            ? contribution.carLitersPer100Km()
            : contribution.motorbikeLitersPer100Km();
    BigDecimal perKm =
        contribution
            .fuelPriceVndPerLiter()
            .multiply(consumption)
            .divide(ONE_HUNDRED, 8, RoundingMode.HALF_UP)
            .divide(BigDecimal.valueOf(passengerSeats + 1L), 8, RoundingMode.HALF_UP)
            .max(contribution.minimumPerKmVnd())
            .min(contribution.maximumPerKmVnd());
    long suggestedPerKm = perKm.setScale(0, RoundingMode.HALF_UP).longValueExact();
    BigDecimal rawAmount =
        perKm
            .multiply(BigDecimal.valueOf(sharedDistanceMeters))
            .divide(ONE_THOUSAND, 8, RoundingMode.HALF_UP);
    long amount =
        rawAmount
            .divide(ONE_THOUSAND, 0, RoundingMode.HALF_UP)
            .multiply(ONE_THOUSAND)
            .longValueExact();
    Instant expiresAt = now.plus(routing.estimateTtl());
    if (expiresAt.isAfter(route.expiresAt())) expiresAt = route.expiresAt();
    return new ContributionEstimate(
        identifiers.get(),
        route.id(),
        sharedDistanceMeters,
        suggestedPerKm,
        amount,
        contribution.demo(),
        now,
        expiresAt);
  }

  private void requireRoutingAccess(String ownerUserId) {
    IdentityAccess.Access access = accounts.require(ownerUserId);
    if (access.verifiedMember()) return;
    if (routing.allowUnverifiedMembers() && access.member()) return;
    throw new RouteAccessDeniedException();
  }

  private PlaceSnapshot place(String ownerUserId, String reference) {
    if (reference == null || !reference.matches("[A-Za-z0-9_-]{8,100}")) {
      throw new InvalidRouteRequestException();
    }
    return places.find(ownerUserId, reference).orElseThrow(PlaceReferenceExpiredException::new);
  }

  public static final class InvalidRouteRequestException extends RuntimeException {}

  public static final class RouteNotFoundException extends RuntimeException {}

  public static final class EstimateExpiredException extends RuntimeException {}

  public static final class RouteAccessDeniedException extends RuntimeException {}

  public static final class PlaceReferenceExpiredException extends RuntimeException {}
}
