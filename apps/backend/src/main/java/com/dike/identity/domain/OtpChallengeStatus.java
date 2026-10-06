package com.dike.identity.domain;

public enum OtpChallengeStatus {
  PENDING_DELIVERY,
  ACTIVE,
  CONSUMED,
  SUPERSEDED,
  EXPIRED,
  LOCKED,
  DELIVERY_FAILED,
  DELIVERY_UNKNOWN,
  CANCELLED
}
