package com.dike.community;

import java.time.Instant;

/** Port for notifying participants without coupling community to a delivery transport. */
public interface SocialRealtimePublisher {
  record Change(
      String eventId,
      String relationId,
      String recipient,
      String counterpart,
      String action,
      long version,
      Instant occurredAt) {}

  void publish(Change change);
}
