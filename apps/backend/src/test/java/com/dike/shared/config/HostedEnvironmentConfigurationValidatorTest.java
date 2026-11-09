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

  @Test
  void acceptsRestrictedDemoWithoutObjectStorage() {
    assertThatNoException()
        .isThrownBy(() -> new HostedEnvironmentConfigurationValidator(validDemo()).run(null));
  }

  @Test
  void demoCannotEnableDeveloperLogin() {
    var environment = validDemo().withProperty("dike.auth.dev-login-enabled", "true");
    assertThatThrownBy(() -> new HostedEnvironmentConfigurationValidator(environment).run(null))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("dike.auth.dev-login-enabled");
  }

  @Test
  void demoRequiresRealRoutingCredentials() {
    var environment = validDemo().withProperty("dike.routing.api-key", "local-not-configured");
    assertThatThrownBy(() -> new HostedEnvironmentConfigurationValidator(environment).run(null))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("dike.routing.api-key");
  }

  @Test
  void demoCannotBeMixedWithProductionProfiles() {
    var environment = validDemo();
    environment.setActiveProfiles("production", "demo", "combined");
    assertThatThrownBy(() -> new HostedEnvironmentConfigurationValidator(environment).run(null))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("spring.profiles.active");
  }

  @Test
  void demoRejectsPublicUnencryptedRedis() {
    var environment = validDemo().withProperty("spring.data.redis.host", "redis.example.test");
    assertThatThrownBy(() -> new HostedEnvironmentConfigurationValidator(environment).run(null))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("spring.data.redis.host");
  }

  private MockEnvironment validDemo() {
    var environment =
        validHostedEnvironment()
            .withProperty("dike.environment", "demo")
            .withProperty("dike.workload", "combined")
            .withProperty("spring.data.redis.host", "red-demo123")
            .withProperty("spring.data.redis.ssl.enabled", "false")
            .withProperty("dike.auth.public-base-url", "https://dike-v2.vercel.app")
            .withProperty("dike.auth.allowed-origins", "https://dike-v2.vercel.app")
            .withProperty("dike.auth.dev-login-enabled", "false")
            .withProperty("dike.auth.require-phone-otp", "false")
            .withProperty("dike.auth.cookie.secure", "true")
            .withProperty("dike.auth.cookie.name", "__Host-DIKE_SESSION")
            .withProperty("dike.otp.provider", "disabled")
            .withProperty("dike.otp.send-enabled", "false")
            .withProperty("dike.routing.provider", "goong")
            .withProperty(
                "spring.security.oauth2.client.registration.google.client-id", "google-demo-client")
            .withProperty(
                "spring.security.oauth2.client.registration.google.client-secret",
                "google-demo-secret");
    environment.setActiveProfiles("demo", "combined");
    return environment;
  }
}
