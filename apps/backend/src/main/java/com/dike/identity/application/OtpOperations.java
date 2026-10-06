package com.dike.identity.application;

import com.dike.identity.domain.OtpChallengeStatus;
import com.dike.identity.domain.OtpPurpose;
import java.time.Instant;

public interface OtpOperations {

  ChallengeView issue(
      String userId,
      String deviceSessionId,
      String clientIp,
      OtpPurpose purpose,
      long phoneVersion,
      String requestKey);

  ChallengeView status(String userId, String deviceSessionId, String challengeId);

  void verify(
      String userId,
      String deviceSessionId,
      String clientIp,
      String challengeId,
      String code,
      String requestKey);

  void cancel(String userId, String deviceSessionId, String challengeId);

  record ChallengeView(
      String challengeId,
      OtpChallengeStatus status,
      Instant expiresAt,
      Instant resendAfter,
      String maskedPhone) {}

  final class OtpException extends RuntimeException {
    private final Reason reason;
    private final java.time.Duration retryAfter;

    public OtpException(Reason reason) {
      this(reason, java.time.Duration.ZERO);
    }

    public OtpException(Reason reason, java.time.Duration retryAfter) {
      super(reason.name());
      this.reason = reason;
      this.retryAfter = retryAfter;
    }

    public Reason reason() {
      return reason;
    }

    public java.time.Duration retryAfter() {
      return retryAfter;
    }
  }

  enum Reason {
    PHONE_STATE_CHANGED,
    PHONE_REQUIRED,
    CHALLENGE_NOT_FOUND,
    CHALLENGE_NOT_ACTIVE,
    CODE_INVALID,
    DELIVERY_FAILED,
    SEND_DISABLED,
    RATE_LIMITED
  }
}
