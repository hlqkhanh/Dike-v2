package com.dike.planning.infrastructure.routing;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.net.URI;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "dike.routing")
public record RoutingProperties(
    @NotBlank String provider,
    @NotBlank String apiKey,
    @NotNull URI baseUrl,
    @NotNull Duration connectTimeout,
    @NotNull Duration requestTimeout,
    @NotNull Duration placeSessionTtl,
    @NotNull Duration cacheTtl,
    @NotNull Duration estimateTtl,
    @NotBlank String cacheKeySecret,
    boolean allowUnverifiedMembers) {}
