package com.dike.shared.api;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

  @ExceptionHandler(ApiException.class)
  ResponseEntity<ErrorResponse> handleApi(ApiException exception, HttpServletRequest request) {
    return response(
        exception.status(),
        exception.code(),
        exception.getMessage(),
        requestId(request),
        List.of());
  }

  @ExceptionHandler(HttpMessageNotReadableException.class)
  ResponseEntity<ErrorResponse> handleMalformed(
      HttpMessageNotReadableException exception, HttpServletRequest request) {
    return response(
        HttpStatus.BAD_REQUEST,
        "MALFORMED_REQUEST",
        "Nội dung yêu cầu không hợp lệ",
        requestId(request),
        List.of());
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  ResponseEntity<ErrorResponse> handleValidation(
      MethodArgumentNotValidException exception, HttpServletRequest request) {
    List<ErrorResponse.FieldViolation> fields =
        exception.getBindingResult().getFieldErrors().stream().map(this::toViolation).toList();

    return response(
        HttpStatus.BAD_REQUEST,
        "VALIDATION_ERROR",
        "Dữ liệu không hợp lệ",
        requestId(request),
        fields);
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<ErrorResponse> handleUnexpected(Exception exception, HttpServletRequest request) {
    return response(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "INTERNAL_ERROR",
        "Hệ thống không thể xử lý yêu cầu",
        requestId(request),
        List.of());
  }

  private ErrorResponse.FieldViolation toViolation(FieldError error) {
    return new ErrorResponse.FieldViolation(error.getField(), error.getCode());
  }

  private ResponseEntity<ErrorResponse> response(
      HttpStatus status,
      String code,
      String message,
      String requestId,
      List<ErrorResponse.FieldViolation> fields) {
    return ResponseEntity.status(status)
        .body(new ErrorResponse(new ErrorResponse.ErrorBody(code, message, requestId, fields)));
  }

  private String requestId(HttpServletRequest request) {
    Object requestId = request.getAttribute(RequestIdFilter.REQUEST_ID_ATTRIBUTE);
    return requestId == null ? "unknown" : requestId.toString();
  }
}
