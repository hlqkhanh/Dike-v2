package com.dike.identity.infrastructure.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class TrustedOriginFilterTest {

  private final TrustedOriginFilter filter = new TrustedOriginFilter(properties());

  @Test
  void acceptsConfiguredOriginForMutation() throws Exception {
    MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth/logout");
    request.addHeader("Origin", "http://localhost:3000");
    MockHttpServletResponse response = new MockHttpServletResponse();
    MockFilterChain chain = new MockFilterChain();

    filter.doFilter(request, response, chain);

    assertThat(chain.getRequest()).isNotNull();
  }

  @Test
  void rejectsUnknownOrMissingOriginForMutation() throws Exception {
    MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth/logout");
    request.addHeader("Origin", "https://evil.example");
    MockHttpServletResponse response = new MockHttpServletResponse();

    filter.doFilter(request, response, new MockFilterChain());

    assertThat(response.getStatus()).isEqualTo(403);
    assertThat(response.getContentAsString()).contains("ORIGIN_NOT_ALLOWED");
  }

  @Test
  void rejectsMalformedOriginWithoutLeakingServerError() throws Exception {
    MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth/logout");
    request.addHeader("Origin", "not a valid origin");
    MockHttpServletResponse response = new MockHttpServletResponse();

    filter.doFilter(request, response, new MockFilterChain());

    assertThat(response.getStatus()).isEqualTo(403);
    assertThat(response.getContentAsString()).contains("ORIGIN_NOT_ALLOWED");
  }

  private IdentityProperties properties() {
    return new IdentityProperties(
        URI.create("http://localhost:3000"),
        List.of(URI.create("http://localhost:3000")),
        false,
        new IdentityProperties.Session(
            Duration.ofHours(24), Duration.ofDays(30), Duration.ofMinutes(5), 10),
        new IdentityProperties.Cookie("DIKE_SESSION", false, "Lax"),
        new IdentityProperties.Google("https://accounts.google.com", "google"));
  }
}
