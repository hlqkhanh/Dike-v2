package com.dike.identity.application;

public interface OtpProvider {

  DeliveryResult send(DeliveryRequest request);

  record DeliveryRequest(String dispatchId, String phoneE164, String code) {}

  record DeliveryResult(DeliveryState state, String providerReference, String errorCategory) {}

  enum DeliveryState {
    ACCEPTED,
    REJECTED,
    UNKNOWN
  }
}
