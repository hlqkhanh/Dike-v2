package com.dike.assistant.infrastructure;

import com.dike.assistant.application.AssistantStore;
import com.dike.shared.api.ApiException;
import java.time.Duration;
import java.util.List;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class RedisAssistantStore implements AssistantStore {
  private final StringRedisTemplate redis;

  @org.springframework.beans.factory.annotation.Value("${dike.environment:local}")
  private String environment;

  @org.springframework.beans.factory.annotation.Value("${dike.assistant.daily-request-limit:500}")
  private long dailyLimit;

  public RedisAssistantStore(StringRedisTemplate redis) {
    this.redis = redis;
  }

  private String key(String actor, String id) {
    return "dike:" + environment + ":assistant:" + actor + ":" + id;
  }

  public String read(String actor, String id) {
    return redis.opsForValue().get(key(actor, id));
  }

  public void save(String actor, String id, String value) {
    redis.opsForValue().set(key(actor, id), value, Duration.ofHours(24));
  }

  public void delete(String actor, String id) {
    redis.delete(key(actor, id));
  }

  public boolean lock(String actor, String id, String token) {
    return Boolean.TRUE.equals(
        redis.opsForValue().setIfAbsent(key(actor, id) + ":lock", token, Duration.ofSeconds(60)));
  }

  public void unlock(String actor, String id, String token) {
    redis.execute(
        new DefaultRedisScript<Long>(
            "if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end",
            Long.class),
        List.of(key(actor, id) + ":lock"),
        token);
  }

  public void acquire(String actor) {
    Long count =
        redis.execute(
            new DefaultRedisScript<Long>(
                "local n=redis.call('incr',KEYS[1]); if n==1 then redis.call('expire',KEYS[1],60) end; return n",
                Long.class),
            List.of(key(actor, "rate")));
    if (count == null || count > 10)
      throw new ApiException(
          HttpStatus.TOO_MANY_REQUESTS,
          "ASSISTANT_RATE_LIMIT",
          "Bạn gửi hơi nhanh. Hãy chờ một phút rồi thử lại.");
  }

  public void acquireAi() {
    String key = key("budget", java.time.LocalDate.now(java.time.ZoneOffset.UTC).toString());
    Long count =
        redis.execute(
            new DefaultRedisScript<Long>(
                "local n=redis.call('incr',KEYS[1]); if n==1 then redis.call('expire',KEYS[1],86400) end; return n",
                Long.class),
            List.of(key));
    if (count == null || count > dailyLimit)
      throw new ApiException(
          HttpStatus.TOO_MANY_REQUESTS,
          "ASSISTANT_DAILY_LIMIT",
          "Trợ lý đã đạt giới hạn AI trong ngày. Hướng dẫn và form vẫn sử dụng được.");
  }
}
