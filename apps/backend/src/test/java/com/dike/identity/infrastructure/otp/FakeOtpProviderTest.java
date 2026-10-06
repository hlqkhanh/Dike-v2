package com.dike.identity.infrastructure.otp;

import static org.assertj.core.api.Assertions.assertThat;

import com.dike.identity.application.OtpProvider;
import org.junit.jupiter.api.Test;

class FakeOtpProviderTest {

  @Test
  void capturesCodeByOpaqueDispatchIdWithoutReturningItInDeliveryResult() {
    var provider = new FakeOtpProvider();

    var result =
        provider.send(new OtpProvider.DeliveryRequest("dispatch-1", "+84901234567", "012345"));

    assertThat(result.state()).isEqualTo(OtpProvider.DeliveryState.ACCEPTED);
    assertThat(result.providerReference()).isEqualTo("dispatch-1");
    assertThat(result.toString()).doesNotContain("012345");
    assertThat(provider.codeFor("dispatch-1")).contains("012345");
  }
}
