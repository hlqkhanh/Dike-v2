package com.dike.shared.outbox;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class OutboxHandlerRegistry {

  private final Map<Key, OutboxHandler> handlers;

  public OutboxHandlerRegistry(List<OutboxHandler> handlers) {
    Map<Key, OutboxHandler> indexed = new HashMap<>();
    for (OutboxHandler handler : handlers) {
      for (String type : handler.eventTypes()) {
        Key key = new Key(type, handler.payloadVersion());
        if (indexed.put(key, handler) != null) {
          throw new IllegalStateException("Duplicate outbox handler for " + key);
        }
      }
    }
    this.handlers = Map.copyOf(indexed);
  }

  public OutboxHandler require(String eventType, int payloadVersion) {
    OutboxHandler handler = handlers.get(new Key(eventType, payloadVersion));
    if (handler == null) {
      throw new IllegalArgumentException(
          "No outbox handler for " + eventType + " v" + payloadVersion);
    }
    return handler;
  }

  private record Key(String eventType, int payloadVersion) {}
}
