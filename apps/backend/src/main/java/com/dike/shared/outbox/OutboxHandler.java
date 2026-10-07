package com.dike.shared.outbox;

public interface OutboxHandler {

  /** Stable consumer identity used by the fan-out delivery ledger. */
  String consumerName();

  String eventType();

  default java.util.Set<String> eventTypes() {
    return java.util.Set.of(eventType());
  }

  int payloadVersion();

  void handle(OutboxEvent event);
}
