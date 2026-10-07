package com.dike.planning.application;

import java.time.Duration;

public interface RoutingRateLimiter {
  boolean tryAcquire(
      String action, String userId, String clientAddress, long limit, Duration window);
}
