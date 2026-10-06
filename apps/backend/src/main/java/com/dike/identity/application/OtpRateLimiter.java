package com.dike.identity.application;

import java.time.Duration;

public interface OtpRateLimiter {

  Decision reserveIssue(String userId, String phoneKey, String deviceSessionId, String clientIp);

  Decision reserveVerify(String userId, String phoneKey, String deviceSessionId, String clientIp);

  record Decision(boolean allowed, Duration retryAfter) {
    public static Decision allowedDecision() {
      return new Decision(true, Duration.ZERO);
    }
  }
}
