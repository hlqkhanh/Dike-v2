package com.dike.shared.api;

import java.time.Duration;
import org.springframework.http.HttpStatus;

public class ApiException extends RuntimeException {

  private final HttpStatus status;
  private final String code;
  private final Duration retryAfter;

  public ApiException(HttpStatus status, String code, String message) {
    this(status, code, message, Duration.ZERO);
  }

  public ApiException(HttpStatus status, String code, String message, Duration retryAfter) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }

  HttpStatus status() {
    return status;
  }

  String code() {
    return code;
  }

  Duration retryAfter() {
    return retryAfter;
  }
}
