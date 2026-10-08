package com.dike.identity.application;

/** Describes whether effective member/driver privileges come from real or local-only evidence. */
public enum AccessMode {
  RESTRICTED,
  REAL,
  SIMULATED
}
