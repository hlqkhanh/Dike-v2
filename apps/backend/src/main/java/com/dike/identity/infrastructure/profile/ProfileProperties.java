package com.dike.identity.infrastructure.profile;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.net.URI;
import java.time.Duration;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "dike.profile")
public record ProfileProperties(
    @Valid @NotNull Documents documents,
    @Valid @NotNull Files files,
    @Valid @NotNull Deletion deletion) {

  public record Documents(
      @NotBlank String termsVersion,
      @NotNull URI termsUrl,
      @NotBlank String privacyVersion,
      @NotNull URI privacyUrl,
      @NotBlank String ageVersion) {
    public Map<String, String> versions() {
      return Map.of(
          "TERMS", termsVersion,
          "PRIVACY_NOTICE", privacyVersion,
          "AGE_18_ATTESTATION", ageVersion);
    }
  }

  public record Files(
      @NotNull Duration uploadTtl,
      @NotNull Duration downloadTtl,
      @NotNull Duration cleanupAge,
      @NotNull URI publicBaseUrl,
      @NotBlank String inspector,
      @Min(1) long avatarMaximumBytes,
      @Min(1) long verificationMaximumBytes,
      @Min(1) int maximumImagePixels) {}

  public record Deletion(@NotNull Duration waitingPeriod, @NotBlank String policyVersion) {}
}
