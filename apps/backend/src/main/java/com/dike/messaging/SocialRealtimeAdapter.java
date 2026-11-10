package com.dike.messaging;

import com.dike.community.SocialRealtimePublisher;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
final class SocialRealtimeAdapter implements SocialRealtimePublisher {
  private final RealtimePublisher realtime;

  SocialRealtimeAdapter(RealtimePublisher realtime) {
    this.realtime = realtime;
  }

  @Override
  public void publish(Change change) {
    realtime.publish(
        new RealtimeEnvelope(
            change.eventId() + ":" + change.recipient(),
            "social.relationship.changed",
            1,
            change.recipient(),
            "/queue/social",
            Map.of(
                "relationId",
                change.relationId(),
                "counterpartUserId",
                change.counterpart(),
                "action",
                change.action(),
                "relationVersion",
                change.version()),
            change.occurredAt()));
  }
}
