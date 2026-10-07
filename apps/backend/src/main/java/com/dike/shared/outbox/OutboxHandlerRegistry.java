package com.dike.shared.outbox;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class OutboxHandlerRegistry {

  private final Map<Key, List<OutboxHandler>> handlers;

  public OutboxHandlerRegistry(List<OutboxHandler> handlers) {
    Map<Key, List<OutboxHandler>> indexed = new HashMap<>();
    Map<String, OutboxHandler> consumers = new HashMap<>();
    for (OutboxHandler handler : handlers) {
      OutboxHandler previous = consumers.put(handler.consumerName(), handler);
      if (previous != null && previous != handler) {
        throw new IllegalStateException("Duplicate outbox consumer " + handler.consumerName());
      }
      for (String type : handler.eventTypes()) {
        Key key = new Key(type, handler.payloadVersion());
        indexed.computeIfAbsent(key, ignored -> new ArrayList<>()).add(handler);
      }
    }
    Map<Key, List<OutboxHandler>> immutable = new HashMap<>();
    indexed.forEach((key, value) -> immutable.put(key, List.copyOf(value)));
    this.handlers = Map.copyOf(immutable);
  }

  public List<OutboxHandler> requireAll(String eventType, int payloadVersion) {
    List<OutboxHandler> matching = handlers.get(new Key(eventType, payloadVersion));
    if (matching == null || matching.isEmpty()) {
      throw new IllegalArgumentException(
          "No outbox handler for " + eventType + " v" + payloadVersion);
    }
    return matching;
  }

  private record Key(String eventType, int payloadVersion) {}
}
