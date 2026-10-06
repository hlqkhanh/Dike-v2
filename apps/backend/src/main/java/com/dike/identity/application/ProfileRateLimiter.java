package com.dike.identity.application;

import java.time.Duration;

public interface ProfileRateLimiter {
  boolean tryAcquire(
      String action, String userId, String clientAddress, long cost, long limit, Duration window);
}
