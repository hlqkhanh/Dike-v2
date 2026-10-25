package com.dike.planning.api;

import com.dike.planning.api.RoutingRequests.ResolvePlace;
import com.dike.planning.application.PlaceService;
import com.dike.planning.application.RoutePlanningService;
import com.dike.planning.application.RoutingProviderException;
import com.dike.planning.domain.ContributionEstimate;
import com.dike.planning.domain.PlaceSnapshot;
import com.dike.planning.domain.RoutePoint;
import com.dike.planning.domain.RouteSnapshot;
import com.dike.planning.domain.VehicleMode;
import com.dike.shared.api.ApiException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import java.security.Principal;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/routing")
@SecurityRequirement(name = "sessionCookie")
public class RoutingController {

  private final PlaceService places;
  private final RoutePlanningService routes;

  public RoutingController(PlaceService places, RoutePlanningService routes) {
    this.places = places;
    this.routes = routes;
  }

  public record PlaceSessionResponse(String sessionToken, Instant expiresAt) {}

  public record PlaceSuggestionResponse(
      String placeRef, String mainText, String secondaryText, String displayLabel) {}

  public record PlaceResponse(
      String placeRef,
      String displayLabel,
      String publicAreaLabel,
      double longitude,
      double latitude,
      Instant resolvedAt) {}

  public record RoutePlace(
      String displayLabel, String publicAreaLabel, double longitude, double latitude) {}

  public record RouteResponse(
      String id,
      String provider,
      VehicleMode vehicleMode,
      RoutePlace origin,
      RoutePlace destination,
      long distanceMeters,
      long durationSeconds,
      List<RoutePoint> geometry,
      Instant calculatedAt,
      Instant expiresAt) {}

  @PostMapping("/place-sessions")
  @Operation(operationId = "createPlaceSession")
  PlaceSessionResponse createSession(Principal principal, HttpServletRequest request) {
    try {
      var value = places.createSession(principal.getName(), request.getRemoteAddr());
      return new PlaceSessionResponse(value.sessionToken(), value.expiresAt());
    } catch (RuntimeException error) {
      throw mapped(error);
    }
  }

  @GetMapping("/places")
  @Operation(operationId = "autocompletePlaces")
  List<PlaceSuggestionResponse> autocomplete(
      Principal principal,
      @RequestParam @Pattern(regexp = "[A-Za-z0-9_-]{8,100}") String sessionToken,
      @RequestParam String query,
      @RequestParam(required = false) Double biasLatitude,
      @RequestParam(required = false) Double biasLongitude,
      HttpServletRequest request) {
    try {
      return places
          .autocomplete(
              principal.getName(),
              sessionToken,
              query,
              biasLatitude,
              biasLongitude,
              request.getRemoteAddr())
          .stream()
          .map(
              value ->
                  new PlaceSuggestionResponse(
                      value.placeRef(),
                      value.mainText(),
                      value.secondaryText(),
                      value.displayLabel()))
          .toList();
    } catch (RuntimeException error) {
      throw mapped(error);
    }
  }

  @PostMapping("/places/resolve")
  @Operation(operationId = "resolvePlace")
  PlaceResponse resolve(
      Principal principal, @Valid @RequestBody ResolvePlace body, HttpServletRequest request) {
    try {
      PlaceSnapshot value =
          places.resolve(
              principal.getName(), body.sessionToken(), body.placeRef(), request.getRemoteAddr());
      return new PlaceResponse(
          body.placeRef(),
          value.displayLabel(),
          value.publicAreaLabel(),
          value.longitude(),
          value.latitude(),
          value.resolvedAt());
    } catch (RuntimeException error) {
      throw mapped(error);
    }
  }

  @PostMapping("/routes")
  @Operation(operationId = "createRoute")
  RouteResponse route(Principal principal, @Valid @RequestBody RoutingRequests.CreateRoute body) {
    try {
      return response(
          routes.route(
              principal.getName(),
              body.originPlaceRef(),
              body.destinationPlaceRef(),
              body.vehicleMode()));
    } catch (RuntimeException error) {
      throw mapped(error);
    }
  }

  @PostMapping("/places/reverse")
  @Operation(operationId = "reversePlace")
  PlaceResponse reverse(
      Principal principal,
      @Valid @RequestBody RoutingRequests.ReversePlace body,
      HttpServletRequest request) {
    try {
      var resolved =
          places.reverse(
              principal.getName(), body.latitude(), body.longitude(), request.getRemoteAddr());
      var value = resolved.place();
      return new PlaceResponse(
          resolved.placeRef(),
          value.displayLabel(),
          value.publicAreaLabel(),
          value.longitude(),
          value.latitude(),
          value.resolvedAt());
    } catch (RuntimeException error) {
      throw mapped(error);
    }
  }

  @GetMapping("/routes/{id}")
  @Operation(operationId = "getRoute")
  RouteResponse route(Principal principal, @PathVariable String id) {
    try {
      return response(routes.get(principal.getName(), id));
    } catch (RuntimeException error) {
      throw mapped(error);
    }
  }

  @PostMapping("/estimates")
  @Operation(operationId = "createContributionEstimate")
  ContributionEstimate estimate(
      Principal principal, @Valid @RequestBody RoutingRequests.CreateEstimate body) {
    try {
      return routes.estimate(
          principal.getName(),
          body.routeSnapshotId(),
          body.sharedDistanceMeters(),
          body.passengerSeats());
    } catch (RuntimeException error) {
      throw mapped(error);
    }
  }

  private RouteResponse response(RouteSnapshot value) {
    return new RouteResponse(
        value.id(),
        value.provider(),
        value.vehicleMode(),
        routePlace(value.origin()),
        routePlace(value.destination()),
        value.distanceMeters(),
        value.durationSeconds(),
        value.geometry(),
        value.calculatedAt(),
        value.expiresAt());
  }

  private RoutePlace routePlace(PlaceSnapshot value) {
    return new RoutePlace(
        value.displayLabel(), value.publicAreaLabel(), value.longitude(), value.latitude());
  }

  private ApiException mapped(RuntimeException error) {
    if (error instanceof PlaceService.InvalidPlaceRequestException) {
      return new ApiException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          "PLACE_INVALID_REQUEST",
          "Yêu cầu địa điểm không hợp lệ");
    }
    if (error instanceof PlaceService.PlaceSessionUnavailableException) {
      return new ApiException(
          HttpStatus.CONFLICT,
          "PLACE_SESSION_INVALID",
          "Phiên chọn địa điểm đã hết hạn hoặc đã được sử dụng");
    }
    if (error instanceof PlaceService.PlaceRateLimitedException) {
      return new ApiException(
          HttpStatus.TOO_MANY_REQUESTS,
          "ROUTING_RATE_LIMITED",
          "Đã có quá nhiều yêu cầu địa điểm",
          java.time.Duration.ofMinutes(1));
    }
    if (error instanceof PlaceService.PlaceAccessDeniedException) {
      return new ApiException(
          HttpStatus.FORBIDDEN, "ROUTING_ACCESS_DENIED", "Tài khoản không thể dùng định tuyến");
    }
    if (error instanceof RoutePlanningService.RouteNotFoundException) {
      return new ApiException(
          HttpStatus.NOT_FOUND, "ROUTE_NOT_FOUND", "Không tìm thấy tuyến đường");
    }
    if (error instanceof RoutePlanningService.EstimateExpiredException) {
      return new ApiException(
          HttpStatus.CONFLICT, "ESTIMATE_EXPIRED", "Tuyến đường đã hết hạn, vui lòng tính lại");
    }
    if (error instanceof RoutePlanningService.RouteAccessDeniedException) {
      return new ApiException(
          HttpStatus.FORBIDDEN, "ROUTING_ACCESS_DENIED", "Tài khoản không thể dùng định tuyến");
    }
    if (error instanceof RoutePlanningService.PlaceReferenceExpiredException) {
      return new ApiException(
          HttpStatus.CONFLICT, "PLACE_REFERENCE_EXPIRED", "Địa điểm đã hết hạn, vui lòng chọn lại");
    }
    if (error instanceof RoutePlanningService.InvalidRouteRequestException) {
      return new ApiException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          "ROUTE_INVALID_REQUEST",
          "Yêu cầu tuyến đường không hợp lệ");
    }
    if (error instanceof RoutingProviderException provider) {
      HttpStatus status =
          switch (provider.code()) {
            case "PLACE_NOT_FOUND" -> HttpStatus.NOT_FOUND;
            case "ROUTING_RATE_LIMITED" -> HttpStatus.TOO_MANY_REQUESTS;
            case "ROUTING_TIMEOUT" -> HttpStatus.GATEWAY_TIMEOUT;
            default -> HttpStatus.SERVICE_UNAVAILABLE;
          };
      return new ApiException(status, provider.code(), "Dịch vụ địa điểm hiện không khả dụng");
    }
    throw error;
  }
}
