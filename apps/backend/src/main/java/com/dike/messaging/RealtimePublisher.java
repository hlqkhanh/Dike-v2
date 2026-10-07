package com.dike.messaging;

public interface RealtimePublisher {

  void publish(RealtimeEnvelope envelope);
}
