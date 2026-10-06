package com.dike.identity.domain;

public enum FileState {
  PENDING_UPLOAD,
  UPLOADED,
  PROCESSING,
  READY,
  REJECTED,
  DELETION_PENDING,
  DELETED
}
