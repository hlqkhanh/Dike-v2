package com.dike.identity.api;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.dike.identity.application.AuthService;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class AuthBoundaryFilterTest {
  private final AuthBoundaryFilter filter =
      new AuthBoundaryFilter(
          new AuthSettings(
              "http://localhost:3000", "http://localhost:8080/api/v1/auth/callback", false, "", ""),
          mock(AuthService.class));

  @Test
  void rejectsMissingNullAndLookalikeOrigins() {
    var request = new MockHttpServletRequest();
    assertFalse(filter.validOrigin(request));
    request.addHeader("Origin", "null");
    assertFalse(filter.validOrigin(request));
    request.removeHeader("Origin");
    request.addHeader("Origin", "http://localhost:3000.evil.invalid");
    assertFalse(filter.validOrigin(request));
  }

  @Test
  void exactOriginOrRefererWorks() {
    var request = new MockHttpServletRequest();
    request.addHeader("Referer", "http://localhost:3000/account/sessions");
    assertTrue(filter.validOrigin(request));
    request.addHeader("Origin", "https://evil.invalid");
    assertFalse(filter.validOrigin(request));
  }

  @Test
  void hostedConfigCannotBypassOtpOrHttps() {
    assertThrows(
        IllegalArgumentException.class,
        () ->
            new AuthSettings(
                "http://localhost:3000",
                "http://localhost:8080/api/v1/auth/callback",
                "production",
                "id",
                "secret",
                false));
  }
}
