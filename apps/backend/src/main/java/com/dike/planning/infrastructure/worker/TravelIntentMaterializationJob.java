package com.dike.planning.infrastructure.worker;

import com.dike.planning.application.TravelIntentMaterializer;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.springframework.context.event.EventListener;
import org.springframework.core.env.Environment;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
class TravelIntentMaterializationJob {

  private static final DefaultRedisScript<Long> RELEASE =
      new DefaultRedisScript<>(
          "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end",
          Long.class);

  private final TravelIntentMaterializer materializer;
  private final StringRedisTemplate redis;
  private final boolean enabled;
  private final String leaseKey;

  TravelIntentMaterializationJob(
      TravelIntentMaterializer materializer, StringRedisTemplate redis, Environment environment) {
    this.materializer = materializer;
    this.redis = redis;
    String workload = environment.getProperty("dike.workload", "api");
    this.enabled = "worker".equals(workload) || "combined".equals(workload);
    this.leaseKey =
        "dike:"
            + environment.getProperty("dike.environment", "local")
            + ":planning:materializer:lease";
  }

  @EventListener(org.springframework.boot.context.event.ApplicationReadyEvent.class)
  public void onReady() {
    run();
  }

  @Scheduled(fixedDelayString = "${dike.planning.materializer-interval:15m}")
  public void run() {
    if (!enabled) return;
    String owner = UUID.randomUUID().toString();
    Boolean acquired = redis.opsForValue().setIfAbsent(leaseKey, owner, Duration.ofMinutes(10));
    if (!Boolean.TRUE.equals(acquired)) return;
    try {
      materializer.materializeAllActive();
    } finally {
      redis.execute(RELEASE, List.of(leaseKey), owner);
    }
  }
}
