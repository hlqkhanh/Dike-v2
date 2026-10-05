package com.dike.shared.outbox;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.dike.shared.config.DikeProperties;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class OutboxWorkerTest {

  private static final Instant NOW = Instant.parse("2026-01-01T00:00:00Z");

  @Test
  void unknownPayloadVersionIsRetriedAndNeverCompleted() {
    OutboxStore store = mock(OutboxStore.class);
    OutboxEvent event = event(1);
    when(store.claim(anyString(), any(), any())).thenReturn(event, (OutboxEvent) null);
    SimpleMeterRegistry meters = new SimpleMeterRegistry();
    OutboxWorker worker = worker(store, new OutboxHandlerRegistry(List.of()), meters);

    worker.poll();

    ArgumentCaptor<Instant> nextAttempt = ArgumentCaptor.forClass(Instant.class);
    verify(store)
        .fail(
            eq(event),
            nextAttempt.capture(),
            eq(false),
            eq(IllegalArgumentException.class.getSimpleName()));
    assertThat(nextAttempt.getValue()).isBetween(NOW.plusMillis(1600), NOW.plusMillis(2400));
    assertThat(meters.counter("dike.outbox.retried").count()).isEqualTo(1);
  }

  private OutboxWorker worker(
      OutboxStore store, OutboxHandlerRegistry handlers, SimpleMeterRegistry meters) {
    DikeProperties properties =
        new DikeProperties(
            "test",
            "worker",
            new DikeProperties.Service("test"),
            new DikeProperties.Storage(
                URI.create("http://localhost:9000"),
                "us-east-1",
                "key",
                "secret",
                "public",
                "private",
                Duration.ofSeconds(1)),
            new DikeProperties.Outbox(
                Duration.ofSeconds(1),
                Duration.ofSeconds(30),
                Duration.ofSeconds(2),
                Duration.ofMinutes(1),
                3,
                1));
    Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
    return new OutboxWorker(store, handlers, properties, clock, meters);
  }

  private OutboxEvent event(int attempts) {
    return new OutboxEvent(
        "event-1",
        "unknown",
        "Probe",
        "probe-1",
        99,
        Map.of(),
        "correlation-1",
        "causation-1",
        OutboxStatus.PROCESSING,
        attempts,
        NOW,
        NOW.plusSeconds(30),
        "worker-test",
        NOW,
        null,
        null);
  }
}
