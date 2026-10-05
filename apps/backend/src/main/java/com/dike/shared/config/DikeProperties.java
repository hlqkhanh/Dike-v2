package com.dike.shared.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.net.URI;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "dike")
public record DikeProperties(
    @NotBlank String environment,
    @NotBlank String workload,
    @Valid @NotNull Service service,
    @Valid @NotNull Storage storage,
    @Valid @NotNull Outbox outbox) {

  public record Service(@NotBlank String version) {}

  public record Storage(
      @NotNull URI endpoint,
      @NotBlank String region,
      @NotBlank String accessKey,
      @NotBlank String secretKey,
      @NotBlank String publicBucket,
      @NotBlank String privateBucket,
      @NotNull Duration timeout) {}

  public record Outbox(
      @NotNull Duration pollInterval,
      @NotNull Duration leaseDuration,
      @NotNull Duration initialBackoff,
      @NotNull Duration maxBackoff,
      @Min(1) int maxAttempts,
      @Min(1) int batchSize) {}
}
