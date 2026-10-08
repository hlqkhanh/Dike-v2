package com.dike.shared.config;

import static org.assertj.core.api.Assertions.assertThatNoException;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class HostedEnvironmentConfigurationValidatorTest {

  @Test
  void ignoresLocalEnvironment() {
    var validator =
        new HostedEnvironmentConfigurationValidator(
            new MockEnvironment().withProperty("dike.environment", "local"));

    assertThatNoException().isThrownBy(() -> validator.run(null));
  }

  @Test
  void rejectsLocalDependencyInProduction() {
    var environment = validHostedEnvironment();
    environment.setProperty("spring.data.redis.host", "localhost");

    var validator = new HostedEnvironmentConfigurationValidator(environment);

    assertThatThrownBy(() -> validator.run(null))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("spring.data.redis.host");
  }

  @Test
  void acceptsHardenedProductionConfiguration() {
    var validator = new HostedEnvironmentConfigurationValidator(validHostedEnvironment());

    assertThatNoException().isThrownBy(() -> validator.run(null));
  }

  private MockEnvironment validHostedEnvironment() {
    return new MockEnvironment()
        .withProperty("dike.environment", "production")
        .withProperty("dike.workload", "api")
        .withProperty("dike.service.version", "6745dc8")
        .withProperty("spring.mongodb.uri", "mongodb+srv://db.example.test/dike")
        .withProperty("spring.data.redis.host", "redis.example.test")
        .withProperty("spring.data.redis.ssl.enabled", "true")
        .withProperty("dike.storage.endpoint", "https://objects.example.test")
        .withProperty("dike.storage.access-key", "hosted-access-key")
        .withProperty("dike.storage.secret-key", "hosted-secret-key")
        .withProperty("dike.ride.boarding-key", "hosted-boarding-key")
        .withProperty("dike.routing.provider", "goong")
        .withProperty("dike.routing.api-key", "hosted-goong-key")
        .withProperty("dike.planning.contribution.demo", "false")
        .withProperty("dike.realtime.websocket-url", "wss://api.example.test/ws")
        .withProperty("dike.identity.simulated-full-access-enabled", "false");
  }
}
