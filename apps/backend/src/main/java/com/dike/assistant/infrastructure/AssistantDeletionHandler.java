package com.dike.assistant.infrastructure;

import com.dike.shared.outbox.OutboxEvent;
import com.dike.shared.outbox.OutboxHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Component
class AssistantDeletionHandler implements OutboxHandler {
  private final StringRedisTemplate redis;
  private final String environment;

  AssistantDeletionHandler(
      StringRedisTemplate redis, @Value("${dike.environment:local}") String environment) {
    this.redis = redis;
    this.environment = environment;
  }

  public String consumerName() {
    return "assistant.account-deletion.v1";
  }

  public String eventType() {
    return "identity.account.deletion-due";
  }

  public int payloadVersion() {
    return 1;
  }

  public void handle(OutboxEvent event) {
    String actor = String.valueOf(event.payload().get("userId"));
    if (!actor.matches("[A-Za-z0-9_-]{1,100}")) throw new IllegalArgumentException("Invalid actor");
    try (var cursor =
        redis.scan(
            ScanOptions.scanOptions()
                .match("dike:" + environment + ":assistant:" + actor + ":*")
                .count(100)
                .build())) {
      while (cursor.hasNext()) redis.delete(cursor.next());
    }
  }
}
