package com.dike.planning.application;

public final class RoutingProviderException extends RuntimeException {

  private final String code;

  public RoutingProviderException(String code, String message) {
    super(message);
    this.code = code;
  }

  public RoutingProviderException(String code, String message, Throwable cause) {
    super(message, cause);
    this.code = code;
  }

  public String code() {
    return code;
  }
}
