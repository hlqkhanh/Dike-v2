package com.dike.shared.outbox;

public interface OutboxHandler {

  String eventType();

  default java.util.Set<String> eventTypes() {
    return java.util.Set.of(eventType());
  }

  int payloadVersion();

  void handle(OutboxEvent event);
}
