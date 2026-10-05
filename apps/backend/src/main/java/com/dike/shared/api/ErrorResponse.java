package com.dike.shared.api;

import java.util.List;

public record ErrorResponse(ErrorBody error) {

  public record ErrorBody(
      String code, String message, String requestId, List<FieldViolation> fields) {}

  public record FieldViolation(String field, String code) {}
}
