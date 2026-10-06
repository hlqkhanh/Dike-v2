package com.dike.identity.infrastructure.otp;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import org.junit.jupiter.api.Test;

class OtpCodeProtectorTest {

  private final OtpProperties properties =
      new OtpProperties(
          "fake",
          "test-code-secret-with-enough-entropy",
          "test-rate-secret-with-enough-entropy",
          "test-v1",
          Duration.ofMinutes(5),
          Duration.ofMinutes(1),
          5,
          true,
          100);
  private final OtpCodeProtector protector = new OtpCodeProtector(properties);

  @Test
  void bindsCodeToEverySecurityRelevantChallengeField() {
    byte[] mac = protector.codeMac("challenge", "user", 2, "VERIFY_PHONE", 4, "012345");

    assertThat(protector.matches(mac, "challenge", "user", 2, "VERIFY_PHONE", 4, "012345"))
        .isTrue();
    assertThat(protector.matches(mac, "challenge", "user", 3, "VERIFY_PHONE", 4, "012345"))
        .isFalse();
    assertThat(protector.matches(mac, "challenge", "user", 2, "VERIFY_PHONE", 5, "012345"))
        .isFalse();
    assertThat(protector.matches(mac, "challenge", "user", 2, "VERIFY_PHONE", 4, "12345"))
        .isFalse();
  }

  @Test
  void phoneCorrelationRequiresTheSecretKey() {
    OtpCodeProtector other =
        new OtpCodeProtector(
            new OtpProperties(
                "fake",
                properties.hmacSecret(),
                "another-rate-secret-with-enough-entropy",
                "test-v1",
                properties.lifetime(),
                properties.resendCooldown(),
                properties.maximumAttempts(),
                true,
                100));

    assertThat(protector.phoneKey("+84901234567"))
        .doesNotContain("+84901234567")
        .isNotEqualTo(other.phoneKey("+84901234567"));
  }
}
