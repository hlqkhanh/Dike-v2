package com.dike.shared.outbox;

public enum OutboxStatus {
  PENDING,
  PROCESSING,
  RETRY,
  COMPLETED,
  FAILED
}
