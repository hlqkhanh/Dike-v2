package com.dike.ride.payment;

import java.net.URI;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("dike.payment.payos")
public record PayOsProperties(
    boolean enabled,
    String clientId,
    String apiKey,
    String checksumKey,
    URI publicBaseUrl,
    Duration checkoutTtl) {
  public PayOsProperties {
    checkoutTtl = checkoutTtl == null ? Duration.ofMinutes(30) : checkoutTtl;
    if (enabled
        && (clientId == null
            || clientId.isBlank()
            || apiKey == null
            || apiKey.isBlank()
            || checksumKey == null
            || checksumKey.isBlank())) {
      throw new IllegalArgumentException("payOS credentials are required when enabled");
    }
  }

  public boolean configured() {
    return enabled
        && clientId != null
        && !clientId.isBlank()
        && apiKey != null
        && !apiKey.isBlank()
        && checksumKey != null
        && !checksumKey.isBlank();
  }
}
