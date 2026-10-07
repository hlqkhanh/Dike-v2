package com.dike.messaging;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("dike.realtime")
public record RealtimeProperties(
    String websocketUrl, List<String> allowedOrigins, Duration ticketTtl, String redisChannel) {

  public RealtimeProperties {
    allowedOrigins = List.copyOf(allowedOrigins);
    if (websocketUrl == null || websocketUrl.isBlank()) {
      throw new IllegalArgumentException("dike.realtime.websocket-url is required");
    }
    if (allowedOrigins.isEmpty() || allowedOrigins.stream().anyMatch("*"::equals)) {
      throw new IllegalArgumentException("Exact realtime origins are required");
    }
    if (ticketTtl == null || ticketTtl.isZero() || ticketTtl.isNegative()) {
      throw new IllegalArgumentException("Positive realtime ticket TTL is required");
    }
    if (redisChannel == null || redisChannel.isBlank()) {
      throw new IllegalArgumentException("dike.realtime.redis-channel is required");
    }
  }
}
