package com.dike.shared.outbox;

import com.dike.shared.config.DikeProperties;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.annotation.PreDestroy;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@Profile("worker | combined")
class OutboxWorker {

  private static final Logger LOGGER = LoggerFactory.getLogger(OutboxWorker.class);
  private final OutboxStore store;
  private final OutboxHandlerRegistry handlers;
  private final OutboxDeliveryStore deliveries;
  private final DikeProperties properties;
  private final Clock clock;
  private final Counter claimed;
  private final Counter retried;
  private final Counter failed;
  private final String workerId = UUID.randomUUID().toString();
  private volatile boolean accepting = true;

  OutboxWorker(
      OutboxStore store,
      OutboxHandlerRegistry handlers,
      OutboxDeliveryStore deliveries,
      DikeProperties properties,
      Clock clock,
      MeterRegistry meterRegistry) {
    this.store = store;
    this.handlers = handlers;
    this.deliveries = deliveries;
    this.properties = properties;
    this.clock = clock;
    this.claimed = meterRegistry.counter("dike.outbox.claimed");
    this.retried = meterRegistry.counter("dike.outbox.retried");
    this.failed = meterRegistry.counter("dike.outbox.failed");
  }

  @Scheduled(fixedDelayString = "${dike.outbox.poll-interval:1s}")
  void poll() {
    if (!accepting) {
      return;
    }
    for (int i = 0; i < properties.outbox().batchSize(); i++) {
      Instant now = clock.instant();
      OutboxEvent event = store.claim(workerId, now, now.plus(properties.outbox().leaseDuration()));
      if (event == null) {
        return;
      }
      claimed.increment();
      dispatch(event);
    }
  }

  @PreDestroy
  void stop() {
    accepting = false;
  }

  private void dispatch(OutboxEvent event) {
    try {
      for (OutboxHandler handler : handlers.requireAll(event.eventType(), event.payloadVersion())) {
        if (deliveries.isCompleted(event.eventId(), handler.consumerName())) {
          continue;
        }
        try {
          handler.handle(event);
          deliveries.complete(event.eventId(), handler.consumerName(), clock.instant());
        } catch (RuntimeException exception) {
          deliveries.fail(
              event.eventId(),
              handler.consumerName(),
              clock.instant(),
              exception.getClass().getSimpleName());
          throw exception;
        }
      }
      store.complete(event, clock.instant());
    } catch (RuntimeException exception) {
      boolean terminal = event.attempts() >= properties.outbox().maxAttempts();
      store.fail(event, nextAttempt(event), terminal, exception.getClass().getSimpleName());
      (terminal ? failed : retried).increment();
      LOGGER.warn(
          "Outbox handler failed eventId={} eventType={} attempts={}",
          event.eventId(),
          event.eventType(),
          event.attempts());
    }
  }

  private Instant nextAttempt(OutboxEvent event) {
    DikeProperties.Outbox outbox = properties.outbox();
    long multiplier = 1L << Math.min(Math.max(event.attempts() - 1, 0), 20);
    Duration base = outbox.initialBackoff().multipliedBy(multiplier);
    Duration capped = base.compareTo(outbox.maxBackoff()) > 0 ? outbox.maxBackoff() : base;
    double jitter = ThreadLocalRandom.current().nextDouble(0.8, 1.2);
    return clock.instant().plusMillis((long) (capped.toMillis() * jitter));
  }
}
