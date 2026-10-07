package com.dike.planning.infrastructure.routing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.dike.planning.domain.PlaceSnapshot;
import com.dike.planning.domain.VehicleMode;
import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class GoongRoutingProviderTest {

  private static final Instant NOW = Instant.parse("2026-10-07T00:00:00Z");
  private MockRestServiceServer server;
  private GoongRoutingProvider provider;

  @BeforeEach
  void setUp() {
    RestClient.Builder builder = RestClient.builder().baseUrl("https://rsapi.goong.io");
    server = MockRestServiceServer.bindTo(builder).build();
    provider =
        new GoongRoutingProvider(
            builder.build(),
            new RoutingProperties(
                "goong",
                "test-key",
                URI.create("https://rsapi.goong.io"),
                Duration.ofSeconds(2),
                Duration.ofSeconds(5),
                Duration.ofMinutes(5),
                Duration.ofMinutes(10),
                Duration.ofMinutes(15),
                "test-cache-secret",
                false));
  }

  @Test
  void mapsAutocompleteAndPlaceDetailWithoutLeakingExactAddressAsPublicArea() {
    server
        .expect(
            request -> {
              assertThat(request.getURI().getPath()).isEqualTo("/Place/AutoComplete");
              assertThat(request.getURI().getQuery()).contains("api_key=test-key");
              assertThat(request.getURI().getQuery()).contains("sessiontoken=session-1");
            })
        .andExpect(method(HttpMethod.GET))
        .andRespond(
            withSuccess(
                """
                {"predictions":[{"description":"1 Nguyen Hue, Quan 1, HCMC","place_id":"p1",
                "structured_formatting":{"main_text":"1 Nguyen Hue","secondary_text":"Quan 1, HCMC"}}]}
                """,
                MediaType.APPLICATION_JSON));

    server
        .expect(request -> assertThat(request.getURI().getPath()).isEqualTo("/Place/Detail"))
        .andRespond(
            withSuccess(
                """
                {"status":"OK","result":{"place_id":"p1",
                "formatted_address":"1 Nguyen Hue, Quan 1, HCMC",
                "geometry":{"location":{"lat":10.77,"lng":106.70}}}}
                """,
                MediaType.APPLICATION_JSON));

    var suggestion = provider.autocomplete("Nguyen Hue", "session-1", null, null).getFirst();
    assertThat(suggestion.providerPlaceId()).isEqualTo("p1");
    PlaceSnapshot place = provider.resolve("p1", "session-1", NOW);
    assertThat(place.displayLabel()).isEqualTo("1 Nguyen Hue, Quan 1, HCMC");
    assertThat(place.publicAreaLabel()).isEqualTo("Quan 1, HCMC");
    assertThat(place.longitude()).isEqualTo(106.70);
    server.verify();
  }

  @Test
  void mapsMotorbikeRouteAndDecodesGeometry() {
    server
        .expect(
            request -> {
              assertThat(request.getURI().getPath()).isEqualTo("/Direction");
              assertThat(request.getURI().getQuery()).contains("vehicle=bike");
            })
        .andRespond(
            withSuccess(
                """
                {"routes":[{"legs":[{"distance":{"value":1234},"duration":{"value":321}}],
                "overview_polyline":{"points":"_p~iF~ps|U_ulLnnqC_mqNvxq`@"}}]}
                """,
                MediaType.APPLICATION_JSON));

    var route =
        provider.route(place("a", 106.7, 10.77), place("b", 106.71, 10.78), VehicleMode.MOTORBIKE);

    assertThat(route.provider()).isEqualTo("GOONG");
    assertThat(route.distanceMeters()).isEqualTo(1234);
    assertThat(route.durationSeconds()).isEqualTo(321);
    assertThat(route.geometry()).hasSize(3);
    server.verify();
  }

  private PlaceSnapshot place(String id, double longitude, double latitude) {
    return new PlaceSnapshot("GOONG", id, id, "Area", longitude, latitude, NOW);
  }
}
