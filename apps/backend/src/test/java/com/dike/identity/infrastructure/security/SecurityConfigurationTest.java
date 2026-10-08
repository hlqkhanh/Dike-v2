package com.dike.identity.infrastructure.security;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.dike.identity.infrastructure.otp.OtpProperties;
import java.net.URI;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class SecurityConfigurationTest {

  @Test
  void rejectsSimulatedFullAccessInHostedEnvironment() {
    var auth =
        new IdentityProperties(
            URI.create("https://api.example.test"),
            List.of(URI.create("https://app.example.test")),
            true,
            new IdentityProperties.Session(
                Duration.ofHours(24), Duration.ofDays(30), Duration.ofMinutes(5), 10),
            new IdentityProperties.Cookie("__Host-DIKE_SESSION", true, "Lax"),
            new IdentityProperties.Google("https://accounts.google.com", "google"));
    var otp =
        new OtpProperties(
            "real",
            "hosted-hmac-secret",
            "hosted-rate-key-secret",
            "v1",
            Duration.ofMinutes(5),
            Duration.ofMinutes(1),
            5,
            true,
            1000);
    var environment =
        new MockEnvironment()
            .withProperty("dike.environment", "staging")
            .withProperty(
                "spring.security.oauth2.client.registration.google.client-id", "client-id")
            .withProperty(
                "spring.security.oauth2.client.registration.google.client-secret", "client-secret")
            .withProperty("dike.identity.simulated-full-access-enabled", "true");

    var validator =
        new SecurityConfiguration().validateAuthProductionConfiguration(auth, otp, environment);

    assertThatThrownBy(() -> validator.run(null))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Secure auth configuration");
  }
}
