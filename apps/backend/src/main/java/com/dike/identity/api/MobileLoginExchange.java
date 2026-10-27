package com.dike.identity.api;

import jakarta.validation.constraints.Pattern;

public final class MobileLoginExchange {
  private MobileLoginExchange() {}

  public record ExchangeRequest(
      @Pattern(regexp = "[a-f0-9-]{36}") String code,
      @Pattern(regexp = "[A-Za-z0-9_-]{43,128}") String verifier) {}

  public record ExchangeResponse(String token) {}
}
