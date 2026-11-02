package com.dike.planning.infrastructure.routing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNoException;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.dike.planning.domain.PlaceSnapshot;
import com.dike.planning.domain.VehicleMode;
import java.math.BigDecimal;
import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class RoutingProviderTest {

  private static final Instant NOW = Instant.parse("2026-10-07T00:00:00Z");

  @Test
  void decodesPolylineToLongitudeLatitudeGeometry() {
    var points = EncodedPolyline.decode("_p~iF~ps|U_ulLnnqC_mqNvxq`@");

    assertThat(points).hasSize(3);
    assertThat(points.getFirst().latitude()).isEqualTo(38.5);
    assertThat(points.getFirst().longitude()).isEqualTo(-120.2);
    assertThat(points.getLast().latitude()).isEqualTo(43.252);
    assertThat(points.getLast().longitude()).isEqualTo(-126.453);
  }

  @Test
  void fakeProviderIsDeterministicAndLabelsSyntheticData() {
    var provider = new FakeRoutingProvider();
    var suggestions = provider.autocomplete("Đại học", "session-1", null, null);
    PlaceSnapshot origin = provider.resolve(suggestions.getFirst().providerPlaceId(), "s", NOW);
    PlaceSnapshot destination =
        new PlaceSnapshot("FAKE", "other", "Other", "Quận 3", 106.71, 10.79, NOW);

    assertThat(provider.autocomplete("Đại học", "session-2", null, null)).isEqualTo(suggestions);
    assertThat(origin.provider()).isEqualTo("FAKE");
    assertThat(provider.route(origin, destination, VehicleMode.MOTORBIKE).geometry()).hasSize(2);
  }

  @Test
  void hostedEnvironmentRejectsFakeOrUnexpectedGoongHost() {
    var environment = new MockEnvironment().withProperty("dike.environment", "production");
    var fake = properties("fake", "https://rsapi.goong.io", "key");
    var wrongHost = properties("goong", "https://example.test", "key");
    var demo =
        new ContributionProperties(
            true,
            BigDecimal.valueOf(25_000),
            BigDecimal.valueOf(2),
            BigDecimal.valueOf(8),
            BigDecimal.ZERO,
            BigDecimal.valueOf(10_000));

    assertThatThrownBy(
            () ->
                new RoutingConfiguration()
                    .validateRoutingConfiguration(fake, demo, environment)
                    .run(null))
        .hasMessageContaining("Secure Goong");
    assertThatThrownBy(
            () ->
                new RoutingConfiguration()
                    .validateRoutingConfiguration(wrongHost, demo, environment)
                    .run(null))
        .hasMessageContaining("Secure Goong");
    assertThatThrownBy(
            () ->
                new RoutingConfiguration()
                    .validateRoutingConfiguration(
                        properties("goong", "https://rsapi.goong.io", "key"), demo, environment)
                    .run(null))
        .hasMessageContaining("contribution policy");
  }

  @Test
  void demoGoongRequiresTheOfficialHttpsApiAndConfiguredKey() {
    var environment = new MockEnvironment().withProperty("dike.environment", "demo");
    var contribution =
        new ContributionProperties(
            true,
            BigDecimal.valueOf(25_000),
            BigDecimal.valueOf(2),
            BigDecimal.valueOf(8),
            BigDecimal.ZERO,
            BigDecimal.valueOf(10_000));
    assertThatNoException()
        .isThrownBy(
            () ->
                new RoutingConfiguration()
                    .validateRoutingConfiguration(
                        properties("disabled", "https://rsapi.goong.io", "local-not-configured"),
                        contribution,
                        environment)
                    .run(null));
    assertThatNoException()
        .isThrownBy(
            () ->
                new RoutingConfiguration()
                    .validateRoutingConfiguration(
                        properties("goong", "https://rsapi.goong.io", "backend-rest-key"),
                        contribution,
                        environment)
                    .run(null));
    for (String host :
        java.util.List.of("http://rsapi.goong.io", "https://unexpected.example.test")) {
      assertThatThrownBy(
              () ->
                  new RoutingConfiguration()
                      .validateRoutingConfiguration(
                          properties("goong", host, "backend-rest-key"), contribution, environment)
                      .run(null))
          .hasMessageContaining("Secure Goong");
    }
    assertThatThrownBy(
            () ->
                new RoutingConfiguration()
                    .validateRoutingConfiguration(
                        properties("goong", "https://rsapi.goong.io", "local-not-configured"),
                        contribution,
                        environment)
                    .run(null))
        .hasMessageContaining("Secure Goong");
  }

  private RoutingProperties properties(String provider, String baseUrl, String key) {
    return new RoutingProperties(
        provider,
        key,
        URI.create(baseUrl),
        Duration.ofSeconds(2),
        Duration.ofSeconds(5),
        Duration.ofMinutes(5),
        Duration.ofMinutes(10),
        Duration.ofMinutes(15),
        "test-cache-secret",
        false);
  }
}
