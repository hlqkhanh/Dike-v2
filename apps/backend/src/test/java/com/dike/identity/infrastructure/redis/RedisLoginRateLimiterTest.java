package com.dike.identity.infrastructure.redis;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.core.env.Environment;
import org.springframework.data.redis.core.StringRedisTemplate;

class RedisLoginRateLimiterTest {

  @Test
  void appliesIndependentLoginAndFailureLimits() {
    StringRedisTemplate redis = mock(StringRedisTemplate.class);
    Environment environment = mock(Environment.class);
    when(environment.getProperty("dike.environment", "local")).thenReturn("test");
    when(redis.execute(any(), anyList(), any(Object[].class))).thenReturn(10L, 11L, 20L, 21L);
    RedisLoginRateLimiter limiter = new RedisLoginRateLimiter(redis, environment);

    assertThat(limiter.tryAcquireLogin("127.0.0.1")).isTrue();
    assertThat(limiter.tryAcquireLogin("127.0.0.1")).isFalse();
    assertThat(limiter.tryAcquireFailure("127.0.0.1")).isTrue();
    assertThat(limiter.tryAcquireFailure("127.0.0.1")).isFalse();
  }
}
