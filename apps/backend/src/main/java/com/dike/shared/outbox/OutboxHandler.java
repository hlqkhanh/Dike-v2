package com.dike.shared.outbox;

public interface OutboxHandler {

  String eventType();

  int payloadVersion();

  void handle(OutboxEvent event);
}
