package com.dike.identity.infrastructure.otp;

import com.dike.identity.application.OtpProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Rejects delivery without generating a test-code endpoint or contacting an SMS vendor. */
@Component
@ConditionalOnProperty(prefix = "dike.otp", name = "provider", havingValue = "disabled")
final class DisabledOtpProvider implements OtpProvider {
  @Override
  public DeliveryResult send(DeliveryRequest request) {
    return new DeliveryResult(DeliveryState.REJECTED, null, "OTP_DISABLED");
  }
}
