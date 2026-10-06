package com.dike.identity.infrastructure.otp;

import com.dike.identity.application.OtpProvider;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "dike.otp", name = "provider", havingValue = "fake")
public final class FakeOtpProvider implements OtpProvider {

  private final ConcurrentHashMap<String, String> codes = new ConcurrentHashMap<>();

  @Override
  public DeliveryResult send(DeliveryRequest request) {
    codes.put(request.dispatchId(), request.code());
    return new DeliveryResult(DeliveryState.ACCEPTED, request.dispatchId(), null);
  }

  public Optional<String> codeFor(String dispatchId) {
    return Optional.ofNullable(codes.get(dispatchId));
  }
}
