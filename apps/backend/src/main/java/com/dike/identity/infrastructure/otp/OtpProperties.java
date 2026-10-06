package com.dike.identity.infrastructure.otp;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "dike.otp")
public record OtpProperties(
    @NotBlank String provider,
    @NotBlank String hmacSecret,
    @NotBlank String rateKeySecret,
    @NotBlank String keyVersion,
    @NotNull Duration lifetime,
    @NotNull Duration resendCooldown,
    @Min(1) @Max(20) int maximumAttempts,
    boolean sendEnabled,
    @Min(1) int dailyCap) {}
