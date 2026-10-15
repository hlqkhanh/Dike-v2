package com.dike.planning.application;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.dike.planning.domain.*;
import com.dike.planning.infrastructure.routing.RoutingProperties;
import com.dike.shared.api.ApiException;
import java.time.*;
import java.util.*;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.MongoTemplate;

class PickupCompatibilityServiceTest {
  final PostService posts = mock(PostService.class);
  final PostRouteService routes = mock(PostRouteService.class);
  final ResolvedPlaceStore places = mock(ResolvedPlaceStore.class);
  final RoutingProvider provider = mock(RoutingProvider.class);
  final RouteCache cache = mock(RouteCache.class);
  final RoutingProperties config = mock(RoutingProperties.class);
  final MongoTemplate mongo = mock(MongoTemplate.class);
  final Instant now = Instant.parse("2026-10-14T00:00:00Z");
  final Instant departure = now.plusSeconds(3600);
  final PlaceSnapshot a = place("A", 105.70), b = place("B", 105.75), c = place("C", 105.80);
  Document trip;
  final PickupCompatibilityService service =
      new PickupCompatibilityService(
          posts, routes, places, provider, cache, config, mongo, Clock.fixed(now, ZoneOffset.UTC));

  PlaceSnapshot place(String name, double lng) {
    return new PlaceSnapshot("GOONG", name, name, "Hà Nội", lng, 21, now);
  }

  RoutingProvider.RouteResult leg(long meters, long seconds, PlaceSnapshot from, PlaceSnapshot to) {
    return new RoutingProvider.RouteResult(
        "GOONG",
        null,
        meters,
        seconds,
        List.of(
            new RoutePoint(from.longitude(), from.latitude()),
            new RoutePoint(to.longitude(), to.latitude())));
  }

  @BeforeEach
  void setup() {
    var post = mock(PostService.View.class);
    when(post.id()).thenReturn("post");
    when(post.type()).thenReturn("OFFER_RIDE");
    when(post.status()).thenReturn("OPEN");
    when(post.ownerId()).thenReturn("driver");
    when(post.version()).thenReturn(4L);
    when(posts.detail("passenger", "post")).thenReturn(post);
    when(mongo.findById("post", Document.class, "ride_posts"))
        .thenReturn(new Document("sourceId", "trip"));
    trip =
        new Document("_id", "trip")
            .append("driverId", "driver")
            .append("status", "OPEN")
            .append("remainingSeats", 2)
            .append("departureAt", Date.from(departure))
            .append("version", 3L)
            .append("routeVersion", 2L)
            .append("detourMeters", 1000L)
            .append("detourSeconds", 300L)
            .append("stops", List.of());
    when(mongo.findById("trip", Document.class, "trips")).thenReturn(trip);
    when(places.find("passenger", "resolved-pickup")).thenReturn(Optional.of(b));
    var base = mock(RouteSnapshot.class);
    when(base.id()).thenReturn("route");
    when(base.origin()).thenReturn(a);
    when(base.destination()).thenReturn(c);
    when(base.vehicleMode()).thenReturn(VehicleMode.CAR);
    when(base.distanceMeters()).thenReturn(10000L);
    when(base.durationSeconds()).thenReturn(1200L);
    when(base.provider()).thenReturn("GOONG");
    when(base.geometry())
        .thenReturn(List.of(new RoutePoint(a.longitude(), 21), new RoutePoint(c.longitude(), 21)));
    when(routes.snapshot("passenger", "post")).thenReturn(base);
    when(provider.route(a, b, VehicleMode.CAR)).thenReturn(leg(3000, 400, a, b));
    when(provider.route(b, c, VehicleMode.CAR)).thenReturn(leg(7500, 1000, b, c));
    when(config.cacheTtl()).thenReturn(Duration.ofMinutes(10));
    when(mongo.insert(any(PickupCompatibilityService.View.class), eq("pickup_checks")))
        .thenAnswer(call -> call.getArgument(0));
  }

  PickupCompatibilityService.Input input(Instant ready, Instant latest) {
    return new PickupCompatibilityService.Input("resolved-pickup", ready, latest);
  }

  PickupCompatibilityService.View check() {
    return service.check("passenger", "post", input(departure, departure.plusSeconds(3600)));
  }

  @Test
  void sameRouteRequestsNeedNoDirectionsOrSavedRouteButStillRequireAnAvailableTrip() {
    assertThat(service.require("passenger", "post", null)).isNull();
    verifyNoInteractions(routes, provider, cache, places);
    trip.put("remainingSeats", 0);
    assertThatThrownBy(() -> service.require("passenger", "post", null))
        .isInstanceOf(ApiException.class);
  }

  @Test
  void emptyAddressesReuseBothDriverPointsWithoutCallingDirections() {
    var result =
        service.check("passenger", "post", new PickupCompatibilityService.Input(null, null, null));
    assertThat(result.pickup()).isEqualTo(a);
    assertThat(result.dropoff()).isEqualTo(c);
    assertThat(result.extraMeters()).isZero();
    assertThat(result.extraSeconds()).isZero();
    assertThat(result.compatible()).isTrue();
    verifyNoInteractions(provider, places);
  }

  @Test
  void destinationOnlyUsesDriverOriginAndCountsTheRemainingDriverLeg() {
    when(places.find("passenger", "resolved-dropoff")).thenReturn(Optional.of(b));
    var result =
        service.check(
            "passenger",
            "post",
            new PickupCompatibilityService.Input(
                null, null, null, null, "resolved-dropoff", false, false));
    assertThat(result.pickup()).isEqualTo(a);
    assertThat(result.dropoff()).isEqualTo(b);
    assertThat(result.arrivalAt()).isEqualTo(departure.plusSeconds(400));
    assertThat(result.extraMeters()).isEqualTo(500);
    assertThat(result.extraSeconds()).isEqualTo(200);
    verify(provider).route(a, b, VehicleMode.CAR);
    verify(provider).route(b, c, VehicleMode.CAR);
  }

  @Test
  void clearingPrefilledAddressesOverridesOwnedRouteIndependently() {
    var own = mock(RouteSnapshot.class);
    when(own.origin()).thenReturn(b);
    when(own.destination()).thenReturn(b);
    when(own.vehicleMode()).thenReturn(VehicleMode.CAR);
    when(own.expiresAt()).thenReturn(now.plusSeconds(7200));
    when(routes.ownedSnapshot("passenger", "own-route")).thenReturn(own);
    var destinationOnly =
        service.check(
            "passenger",
            "post",
            new PickupCompatibilityService.Input(null, null, null, "own-route", null, true, false));
    assertThat(destinationOnly.pickup()).isEqualTo(a);
    assertThat(destinationOnly.dropoff()).isEqualTo(b);
    var pickupOnly =
        service.check(
            "passenger",
            "post",
            new PickupCompatibilityService.Input(null, null, null, "own-route", null, false, true));
    assertThat(pickupOnly.pickup()).isEqualTo(b);
    assertThat(pickupOnly.dropoff()).isEqualTo(c);
    var both =
        service.check(
            "passenger",
            "post",
            new PickupCompatibilityService.Input(null, null, null, "own-route", null, true, true));
    assertThat(both.pickup()).isEqualTo(a);
    assertThat(both.dropoff()).isEqualTo(c);
  }

  @Test
  void rejectsExpiredAndForgedDropoffReferences() {
    assertThatThrownBy(
            () ->
                service.check(
                    "passenger",
                    "post",
                    new PickupCompatibilityService.Input(
                        null, null, null, null, "unknown-place", false, false)))
        .isInstanceOf(ApiException.class);
    assertThatThrownBy(
            () ->
                service.check(
                    "passenger",
                    "post",
                    new PickupCompatibilityService.Input(
                        null, null, null, null, "bad/ref", false, false)))
        .isInstanceOf(ApiException.class);
    verifyNoInteractions(provider);
  }

  @Test
  void computesRealRoadDetourAndPickupTimeAtCommonDestination() {
    var result = check();
    assertThat(result.compatible()).isTrue();
    assertThat(result.extraMeters()).isEqualTo(500);
    assertThat(result.extraSeconds()).isEqualTo(200);
    assertThat(result.pickupAt()).isEqualTo(departure.plusSeconds(400));
    assertThat(result.arrivalAt()).isEqualTo(departure.plusSeconds(1400));
    assertThat(result.destinationLabel()).isEqualTo("C");
    verify(provider).route(a, b, VehicleMode.CAR);
    verify(provider).route(b, c, VehicleMode.CAR);
    assertThat(result.geometry()).hasSize(4);
    assertThat(result.pickupIndex()).isEqualTo(1);
  }

  @Test
  void simplifiedFormUsesTripDepartureWithoutAskingPassengerForTimes() {
    var result =
        service.check(
            "passenger",
            "post",
            new PickupCompatibilityService.Input("resolved-pickup", null, null));
    assertThat(result.readyAt()).isEqualTo(departure);
    assertThat(result.latestPickupAt()).isEqualTo(departure.plus(Duration.ofHours(4)));
    assertThat(result.compatible()).isTrue();
  }

  @Test
  void prefillsBothPointsFromOwnedJourneyAndIncludesTheDriversRemainingLeg() {
    var dropoff = place("Passenger destination", 105.78);
    var own = mock(RouteSnapshot.class);
    when(own.origin()).thenReturn(b);
    when(own.destination()).thenReturn(dropoff);
    when(own.vehicleMode()).thenReturn(VehicleMode.CAR);
    when(own.expiresAt()).thenReturn(now.plusSeconds(7200));
    when(routes.ownedSnapshot("passenger", "own-route")).thenReturn(own);
    when(provider.route(b, dropoff, VehicleMode.CAR)).thenReturn(leg(4000, 600, b, dropoff));
    when(provider.route(dropoff, c, VehicleMode.CAR)).thenReturn(leg(3500, 400, dropoff, c));

    var result =
        service.check(
            "passenger",
            "post",
            new PickupCompatibilityService.Input(null, null, null, "own-route"));

    assertThat(result.pickup()).isEqualTo(b);
    assertThat(result.dropoff()).isEqualTo(dropoff);
    assertThat(result.destinationLabel()).isEqualTo("Passenger destination");
    assertThat(result.driverDestinationLabel()).isEqualTo("C");
    assertThat(result.extraMeters()).isEqualTo(500);
    assertThat(result.extraSeconds()).isEqualTo(200);
    assertThat(result.arrivalAt()).isEqualTo(departure.plusSeconds(1000));
    assertThat(result.pickupIndex()).isEqualTo(1);
    assertThat(result.dropoffIndex()).isEqualTo(3);
    assertThat(result.geometry()).hasSize(6);
    verifyNoInteractions(places);
    verify(provider).route(dropoff, c, VehicleMode.CAR);
  }

  @Test
  void rejectsExpiredPassengerRouteBeforeCallingDirections() {
    var own = mock(RouteSnapshot.class);
    when(own.expiresAt()).thenReturn(now.minusSeconds(1));
    when(routes.ownedSnapshot("passenger", "expired-route")).thenReturn(own);
    assertThatThrownBy(
            () ->
                service.check(
                    "passenger",
                    "post",
                    new PickupCompatibilityService.Input(null, null, null, "expired-route")))
        .isInstanceOf(ApiException.class);
    verifyNoInteractions(provider, places);
  }

  @Test
  void distanceTimeAndWaitingLimitsAreAllEnforced() {
    trip.put("detourMeters", 400L);
    assertThat(check().reason()).isEqualTo("DETOUR_EXCEEDED");
    trip.put("detourMeters", 1000L);
    trip.put("detourSeconds", 199L);
    assertThat(check().compatible()).isFalse();
    trip.put("detourSeconds", 300L);
    var waiting =
        service.check(
            "passenger", "post", input(departure.plusSeconds(700), departure.plusSeconds(3600)));
    assertThat(waiting.extraSeconds()).isEqualTo(500);
    assertThat(waiting.compatible()).isFalse();
    assertThat(
            service
                .check("passenger", "post", input(departure, departure.plusSeconds(399)))
                .reason())
        .isEqualTo("PICKUP_TOO_LATE");
  }

  @Test
  void rejectsForgedPlaceReferencesUnavailableTripsAndUnsupportedStopsBeforeProviderCalls() {
    when(places.find("passenger", "resolved-pickup")).thenReturn(Optional.empty());
    assertThatThrownBy(this::check).isInstanceOf(ApiException.class);
    trip.put("remainingSeats", 0);
    assertThatThrownBy(this::check).isInstanceOf(ApiException.class);
    trip.put("remainingSeats", 2);
    trip.put("stops", List.of(new Document("kind", "PICKUP")));
    assertThatThrownBy(this::check).isInstanceOf(ApiException.class);
    verifyNoInteractions(provider);
  }

  @Test
  void cacheAvoidsDirectionsRequestsAndRejectsPickupAtDestination() {
    when(cache.find(a, b, VehicleMode.CAR)).thenReturn(Optional.of(leg(3000, 400, a, b)));
    when(cache.find(b, c, VehicleMode.CAR)).thenReturn(Optional.of(leg(7500, 1000, b, c)));
    assertThat(check().compatible()).isTrue();
    verifyNoInteractions(provider);
    when(places.find("passenger", "resolved-pickup")).thenReturn(Optional.of(c));
    assertThatThrownBy(this::check).isInstanceOf(ApiException.class);
  }

  @Test
  void sendingAndAcceptingRecheckOwnershipExpirySeatsAndTripVersions() {
    var check = check();
    when(mongo.findById(check.id(), PickupCompatibilityService.View.class, "pickup_checks"))
        .thenReturn(check);
    assertThat(service.require("passenger", "post", check.id())).isEqualTo(check);
    assertThatThrownBy(() -> service.require("attacker", "post", check.id()))
        .isInstanceOf(ApiException.class);
    trip.put("version", 4L);
    assertThatThrownBy(() -> service.require("passenger", "post", check.id()))
        .isInstanceOf(ApiException.class);
    trip.put("version", 3L);
    trip.put("remainingSeats", 0);
    assertThatThrownBy(() -> service.require("passenger", "post", check.id()))
        .isInstanceOf(ApiException.class);
    trip.put("remainingSeats", 2);
    var later =
        new PickupCompatibilityService(
            posts,
            routes,
            places,
            provider,
            cache,
            config,
            mongo,
            Clock.fixed(now.plusSeconds(301), ZoneOffset.UTC));
    assertThatThrownBy(() -> later.require("passenger", "post", check.id()))
        .isInstanceOf(ApiException.class);
    assertThat(service.require("passenger", "post", null)).isNull();
  }

  @Test
  void sameOriginNeedsNoExtraDirectionsAndProviderFailureDoesNotCreateEvidence() {
    when(places.find("passenger", "resolved-pickup")).thenReturn(Optional.of(a));
    assertThat(check().extraMeters()).isZero();
    verifyNoInteractions(provider);
    when(places.find("passenger", "resolved-pickup")).thenReturn(Optional.of(b));
    when(provider.route(a, b, VehicleMode.CAR))
        .thenThrow(new RoutingProviderException("ROUTING_UNAVAILABLE", "Unavailable"));
    clearInvocations(mongo);
    assertThatThrownBy(this::check).isInstanceOf(ApiException.class);
    verify(mongo, never()).insert(any(PickupCompatibilityService.View.class), eq("pickup_checks"));
  }
}
