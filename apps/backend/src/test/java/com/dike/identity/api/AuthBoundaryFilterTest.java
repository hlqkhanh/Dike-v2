package com.dike.identity.api;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.dike.identity.application.AuthService;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class AuthBoundaryFilterTest {
  private final AuthService auth = mock(AuthService.class);
  private final AuthBoundaryFilter filter =
      new AuthBoundaryFilter(
          new AuthSettings(
              "http://localhost:3000", "http://localhost:8080/api/v1/auth/callback", false, "", ""),
          auth);

  @Test
  void errorsKeepRequestIdAndDistinguishRateLimitFromDependencyFailure() throws Exception {
    var request = new MockHttpServletRequest("GET", "/api/v1/auth/google");
    request.addHeader("X-Request-Id", "request-test-123");
    doThrow(
            new com.dike.shared.api.ApiException(
                org.springframework.http.HttpStatus.TOO_MANY_REQUESTS,
                "RATE_LIMITED",
                "Please wait"))
        .when(auth)
        .rateLimit(anyString());
    var response = new org.springframework.mock.web.MockHttpServletResponse();
    new com.dike.shared.api.RequestIdFilter()
        .doFilter(
            request,
            response,
            (req, res) -> filter.doFilter(req, res, (r, s) -> fail("Must not proceed")));
    assertEquals(429, response.getStatus());
    assertEquals("60", response.getHeader("Retry-After"));
    assertTrue(response.getContentAsString().contains("request-test-123"));
    assertTrue(response.getContentAsString().contains("RATE_LIMITED"));
    doThrow(new org.springframework.dao.DataAccessResourceFailureException("secret-host"))
        .when(auth)
        .rateLimit(anyString());
    var unavailable = new org.springframework.mock.web.MockHttpServletResponse();
    filter.doFilter(request, unavailable, (r, s) -> fail("Must not proceed"));
    assertEquals(503, unavailable.getStatus());
    assertNull(unavailable.getHeader("Retry-After"));
    assertFalse(unavailable.getContentAsString().contains("secret-host"));
  }

  @Test
  void originRejectionStopsMutationAndOAuthRedisFailureUsesJson() throws Exception {
    var request = new MockHttpServletRequest("POST", "/api/v1/auth/logout");
    var response = new org.springframework.mock.web.MockHttpServletResponse();
    filter.doFilter(request, response, (r, s) -> fail("Must not proceed"));
    assertEquals(403, response.getStatus());
    assertEquals("no-store", response.getHeader("Cache-Control"));
    var callback = new MockHttpServletRequest("GET", "/api/v1/auth/callback");
    var failure = new org.springframework.mock.web.MockHttpServletResponse();
    filter.doFilter(
        callback,
        failure,
        (r, s) -> {
          throw new org.springframework.dao.DataAccessResourceFailureException("secret");
        });
    assertEquals(503, failure.getStatus());
    assertTrue(failure.getContentAsString().contains("DEPENDENCY_UNAVAILABLE"));
  }

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
