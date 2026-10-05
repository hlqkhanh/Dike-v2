package com.dike.shared.outbox;

import java.time.Clock;
import java.time.Instant;
import java.util.Map;
import java.util.function.Supplier;
import org.slf4j.MDC;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class OutboxPublisher {

  private final MongoTemplate template;
  private final Clock clock;
  private final Supplier<String> identifierGenerator;

  OutboxPublisher(MongoTemplate template, Clock clock, Supplier<String> identifierGenerator) {
    this.template = template;
    this.clock = clock;
    this.identifierGenerator = identifierGenerator;
  }

  @Transactional
  public OutboxEvent publish(
      String eventType,
      String aggregateType,
      String aggregateId,
      int payloadVersion,
      Map<String, Object> payload) {
    Instant now = clock.instant();
    OutboxEvent event =
        new OutboxEvent(
            identifierGenerator.get(),
            eventType,
            aggregateType,
            aggregateId,
            payloadVersion,
            Map.copyOf(payload),
            MDC.get("correlationId"),
            MDC.get("causationId"),
            OutboxStatus.PENDING,
            0,
            now,
            null,
            null,
            now,
            null,
            null);
    return template.insert(event);
  }
}
