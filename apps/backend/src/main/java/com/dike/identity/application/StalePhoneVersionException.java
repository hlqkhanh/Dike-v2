package com.dike.identity.application;

public final class StalePhoneVersionException extends RuntimeException {

  public StalePhoneVersionException() {
    super("Phone state changed concurrently");
  }
}
