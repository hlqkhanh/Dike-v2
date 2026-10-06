package com.dike.identity.infrastructure.security;

import com.dike.identity.application.AuthTelemetry;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

@Component
final class MicrometerAuthTelemetry implements AuthTelemetry {

  private final MeterRegistry meters;

  MicrometerAuthTelemetry(MeterRegistry meters) {
    this.meters = meters;
  }

  @Override
  public void login(String outcome) {
    meters.counter("dike.auth.login", "outcome", outcome).increment();
  }

  @Override
  public void session(String event) {
    meters.counter("dike.auth.session", "event", event).increment();
  }
}
