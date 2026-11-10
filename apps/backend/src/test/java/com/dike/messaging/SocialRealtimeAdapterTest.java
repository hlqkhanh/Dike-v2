package com.dike.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import com.dike.community.SocialRealtimePublisher;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class SocialRealtimeAdapterTest {
  @Test
  void preservesRecipientSpecificEventIdsAndSocialQueueContract() {
    var publisher = mock(RealtimePublisher.class);
    var adapter = new SocialRealtimeAdapter(publisher);
    var now = Instant.parse("2026-11-10T00:00:00Z");
    adapter.publish(
        new SocialRealtimePublisher.Change(
            "event", "relation", "alice", "bob", "ACCEPTED", 3, now));
    adapter.publish(
        new SocialRealtimePublisher.Change(
            "event", "relation", "bob", "alice", "ACCEPTED", 3, now));
    var captured = ArgumentCaptor.forClass(RealtimeEnvelope.class);
    verify(publisher, times(2)).publish(captured.capture());
    assertThat(captured.getAllValues())
        .extracting(RealtimeEnvelope::eventId)
        .containsExactly("event:alice", "event:bob");
    var first = captured.getAllValues().getFirst();
    assertThat(first.recipientUserId()).isEqualTo("alice");
    assertThat(first.destination()).isEqualTo("/queue/social");
    assertThat(first.eventType()).isEqualTo("social.relationship.changed");
    assertThat(first.payload())
        .isEqualTo(
            Map.of(
                "relationId",
                "relation",
                "counterpartUserId",
                "bob",
                "action",
                "ACCEPTED",
                "relationVersion",
                3L));
    assertThat(first.occurredAt()).isEqualTo(now);
  }
}
