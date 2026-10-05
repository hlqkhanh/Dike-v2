package com.dike.shared.api;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;

class GlobalExceptionHandlerTest {

  private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

  @Test
  void stableApiErrorDoesNotExposeExceptionType() {
    MockHttpServletRequest request = new MockHttpServletRequest();
    request.setAttribute(RequestIdFilter.REQUEST_ID_ATTRIBUTE, "request-12345678");

    var response =
        handler.handleApi(
            new ApiException(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND", "Không tìm thấy"),
            request);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    assertThat(response.getBody().error().code()).isEqualTo("RESOURCE_NOT_FOUND");
    assertThat(response.getBody().error().requestId()).isEqualTo("request-12345678");
    assertThat(response.getBody().toString()).doesNotContain("ApiException");
  }
}
