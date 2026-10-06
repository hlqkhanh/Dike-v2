package com.dike.identity.infrastructure.security;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.net.URI;
import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "dike.auth")
public record IdentityProperties(
    @NotNull URI publicBaseUrl,
    @NotEmpty List<URI> allowedOrigins,
    boolean requirePhoneOtp,
    @Valid @NotNull Session session,
    @Valid @NotNull Cookie cookie,
    @Valid @NotNull Google google) {

  public record Session(
      @NotNull Duration idleTimeout,
      @NotNull Duration absoluteLifetime,
      @NotNull Duration lastSeenWriteInterval,
      @Min(1) @Max(100) int maximumPerUser) {}

  public record Cookie(@NotBlank String name, boolean secure, @NotBlank String sameSite) {}

  public record Google(@NotBlank String issuer, @NotBlank String registrationId) {}
}
