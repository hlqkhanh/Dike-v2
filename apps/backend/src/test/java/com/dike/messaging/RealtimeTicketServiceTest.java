package com.dike.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.dike.identity.IdentityAccess;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

class RealtimeTicketServiceTest {

  @Test
  void storesOnlyTicketDigestInRedis() {
    StringRedisTemplate redis = mock(StringRedisTemplate.class);
    @SuppressWarnings("unchecked")
    ValueOperations<String, String> values = mock(ValueOperations.class);
    when(redis.opsForValue()).thenReturn(values);
    IdentityAccess identities = mock(IdentityAccess.class);
    when(identities.require("user-1"))
        .thenReturn(
            new IdentityAccess.Access(
                "user-1",
                true,
                true,
                false,
                false,
                false,
                false,
                IdentityAccess.DriverEvidence.NONE,
                7));
    Duration ttl = Duration.ofSeconds(30);
    var service =
        new RealtimeTicketService(
            redis,
            new RealtimeProperties(
                "ws://localhost:8080/ws", List.of("http://localhost:3000"), ttl, "test"),
            Clock.fixed(Instant.parse("2026-10-07T00:00:00Z"), ZoneOffset.UTC),
            identities);

    RealtimeTicket issued = service.issue("user-1");

    ArgumentCaptor<String> key = ArgumentCaptor.forClass(String.class);
    verify(values).set(key.capture(), eq("user-1:7"), eq(ttl));
    assertThat(key.getValue()).startsWith("test:ticket:");
    assertThat(key.getValue()).doesNotContain(issued.ticket());
    assertThat(key.getValue()).matches("test:ticket:[0-9a-f]{64}");
    assertThat(issued.expiresAt()).isEqualTo(Instant.parse("2026-10-07T00:00:30Z"));
  }
}
