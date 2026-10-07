package com.dike.planning.infrastructure.routing;

import com.dike.planning.application.RoutingProvider;
import com.dike.planning.application.RoutingProviderException;
import com.dike.planning.domain.PlaceSnapshot;
import com.dike.planning.domain.RoutePoint;
import com.dike.planning.domain.VehicleMode;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

@Component
@ConditionalOnProperty(prefix = "dike.routing", name = "provider", havingValue = "goong")
class GoongRoutingProvider implements RoutingProvider {

  private static final ObjectMapper JSON = new ObjectMapper();

  private final RestClient client;
  private final RoutingProperties properties;
  private final AtomicInteger consecutiveFailures = new AtomicInteger();
  private volatile long circuitOpenUntilNanos;

  GoongRoutingProvider(
      @Qualifier("routingRestClient") RestClient client, RoutingProperties properties) {
    this.client = client;
    this.properties = properties;
  }

  @Override
  public List<PlaceSuggestion> autocomplete(
      String query, String sessionToken, Double biasLatitude, Double biasLongitude) {
    JsonNode response =
        get(
            "/Place/AutoComplete",
            builder -> {
              builder
                  .queryParam("api_key", properties.apiKey())
                  .queryParam("input", query)
                  .queryParam("limit", 10)
                  .queryParam("more_compound", true)
                  .queryParam("sessiontoken", sessionToken);
              if (biasLatitude != null && biasLongitude != null) {
                builder.queryParam("location", biasLatitude + "," + biasLongitude);
              }
            },
            "PLACE_NOT_FOUND");
    List<PlaceSuggestion> values = new ArrayList<>();
    for (JsonNode prediction : response.path("predictions")) {
      JsonNode formatting = prediction.path("structured_formatting");
      String id = text(prediction, "place_id");
      String display = text(prediction, "description");
      if (id != null && display != null) {
        values.add(
            new PlaceSuggestion(
                id, text(formatting, "main_text"), text(formatting, "secondary_text"), display));
      }
    }
    return List.copyOf(values);
  }

  @Override
  public PlaceSnapshot resolve(String providerPlaceId, String sessionToken, Instant resolvedAt) {
    JsonNode response =
        get(
            "/Place/Detail",
            builder ->
                builder
                    .queryParam("api_key", properties.apiKey())
                    .queryParam("place_id", providerPlaceId)
                    .queryParam("sessiontoken", sessionToken),
            "PLACE_NOT_FOUND");
    JsonNode result = response.path("result");
    JsonNode location = result.path("geometry").path("location");
    String address = text(result, "formatted_address");
    if (address == null || !location.path("lat").isNumber() || !location.path("lng").isNumber()) {
      throw new RoutingProviderException("PLACE_NOT_FOUND", "Goong returned no usable place");
    }
    return new PlaceSnapshot(
        "GOONG",
        providerPlaceId,
        address,
        publicArea(address),
        location.path("lng").asDouble(),
        location.path("lat").asDouble(),
        resolvedAt);
  }

  @Override
  public RouteResult route(
      PlaceSnapshot origin, PlaceSnapshot destination, VehicleMode vehicleMode) {
    JsonNode response =
        get(
            "/Direction",
            builder ->
                builder
                    .queryParam("api_key", properties.apiKey())
                    .queryParam("origin", coordinate(origin))
                    .queryParam("destination", coordinate(destination))
                    .queryParam("vehicle", vehicleMode == VehicleMode.CAR ? "car" : "bike")
                    .queryParam("alternatives", false),
            "ROUTE_NOT_FOUND");
    JsonNode route = response.path("routes").path(0);
    if (route.isMissingNode()) {
      throw new RoutingProviderException("ROUTE_NOT_FOUND", "Goong returned no route");
    }
    long distance = 0;
    long duration = 0;
    for (JsonNode leg : route.path("legs")) {
      distance += leg.path("distance").path("value").asLong(-1);
      duration += leg.path("duration").path("value").asLong(-1);
    }
    List<RoutePoint> geometry =
        EncodedPolyline.decode(route.path("overview_polyline").path("points").asText());
    if (distance < 0 || duration < 0 || geometry.isEmpty()) {
      throw new RoutingProviderException("ROUTE_NOT_FOUND", "Goong returned an incomplete route");
    }
    return new RouteResult("GOONG", text(route, "route_id"), distance, duration, geometry);
  }

  private JsonNode get(
      String path,
      java.util.function.Consumer<org.springframework.web.util.UriBuilder> query,
      String emptyCode) {
    if (System.nanoTime() < circuitOpenUntilNanos) {
      throw new RoutingProviderException("ROUTING_UNAVAILABLE", "Routing circuit is open");
    }
    try {
      JsonNode response = request(path, query, emptyCode);
      consecutiveFailures.set(0);
      return response;
    } catch (RoutingProviderException error) {
      if (isAvailabilityFailure(error) && consecutiveFailures.incrementAndGet() >= 5) {
        circuitOpenUntilNanos =
            System.nanoTime() + java.util.concurrent.TimeUnit.SECONDS.toNanos(30);
        consecutiveFailures.set(0);
      }
      throw error;
    }
  }

  private JsonNode request(
      String path,
      java.util.function.Consumer<org.springframework.web.util.UriBuilder> query,
      String emptyCode) {
    for (int attempt = 0; attempt < 2; attempt++) {
      try {
        String body =
            client
                .get()
                .uri(
                    builder -> {
                      builder.path(path);
                      query.accept(builder);
                      return builder.build();
                    })
                .retrieve()
                .body(String.class);
        if (body == null || body.isBlank())
          throw new RoutingProviderException(emptyCode, "Empty provider response");
        try {
          return JSON.readTree(body);
        } catch (com.fasterxml.jackson.core.JsonProcessingException error) {
          throw new RoutingProviderException(
              "ROUTING_UNAVAILABLE", "Routing provider returned malformed data", error);
        }
      } catch (RestClientResponseException error) {
        if (!retryable(error.getStatusCode()) || attempt == 1) throw mapped(error, emptyCode);
      } catch (ResourceAccessException error) {
        if (attempt == 1) {
          throw new RoutingProviderException(
              "ROUTING_TIMEOUT", "Routing provider timed out", error);
        }
      }
      jitter();
    }
    throw new IllegalStateException("Unreachable");
  }

  private boolean isAvailabilityFailure(RoutingProviderException error) {
    return "ROUTING_TIMEOUT".equals(error.code())
        || "ROUTING_RATE_LIMITED".equals(error.code())
        || "ROUTING_UNAVAILABLE".equals(error.code());
  }

  private boolean retryable(HttpStatusCode status) {
    return status.value() == 429 || status.is5xxServerError();
  }

  private RoutingProviderException mapped(RestClientResponseException error, String notFoundCode) {
    int status = error.getStatusCode().value();
    if (status == 429) {
      return new RoutingProviderException(
          "ROUTING_RATE_LIMITED", "Routing provider rate limit reached", error);
    }
    if (status == 404 || status == 400) {
      return new RoutingProviderException(notFoundCode, "Routing resource was not found", error);
    }
    return new RoutingProviderException(
        "ROUTING_UNAVAILABLE", "Routing provider unavailable", error);
  }

  private void jitter() {
    try {
      Thread.sleep(ThreadLocalRandom.current().nextLong(25, 76));
    } catch (InterruptedException error) {
      Thread.currentThread().interrupt();
      throw new RoutingProviderException("ROUTING_UNAVAILABLE", "Routing retry interrupted", error);
    }
  }

  private String coordinate(PlaceSnapshot place) {
    return place.latitude() + "," + place.longitude();
  }

  private String publicArea(String address) {
    String[] parts = address.split(",");
    if (parts.length <= 2) return address.strip();
    return parts[parts.length - 2].strip() + ", " + parts[parts.length - 1].strip();
  }

  private String text(JsonNode node, String field) {
    JsonNode value = node.path(field);
    return value.isTextual() && !value.asText().isBlank() ? value.asText() : null;
  }
}
