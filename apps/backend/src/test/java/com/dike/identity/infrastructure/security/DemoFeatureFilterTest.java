package com.dike.identity.infrastructure.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class DemoFeatureFilterTest {
  @ParameterizedTest
  @ValueSource(
      strings = {
        "/api/v1/files/uploads",
        "/api/v1/files/f1/download-url",
        "/api/v1/auth/otp",
        "/api/v1/auth/otp/id/verify",
        "/api/v1/auth/test/otp/id",
        "/api/v1/auth/dev/mobile"
      })
  void rejectsPaidAndDeveloperFeatures(String path) throws Exception {
    var request = new MockHttpServletRequest("POST", path);
    request.setServletPath(path);
    var response = new MockHttpServletResponse();
    var chain = new MockFilterChain();
    new DemoFeatureFilter().doFilter(request, response, chain);
    assertThat(response.getStatus()).isEqualTo(503);
    assertThat(response.getContentAsString()).contains("DEMO_FEATURE_DISABLED");
    assertThat(chain.getRequest()).isNull();
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "/api/v1/auth/google",
        "/api/v1/auth/callback/google",
        "/api/v1/auth/session",
        "/api/v1/auth/phone",
        "/api/v1/auth/logout",
        "/actuator/health/readiness",
        "/api/v1/routing/place-sessions",
        "/api/v1/routing/places",
        "/api/v1/routing/places/resolve",
        "/api/v1/routing/places/reverse",
        "/api/v1/routing/routes",
        "/api/v1/routing/estimates"
      })
  void preservesGoogleSessionHealthAndRoutingPaths(String path) throws Exception {
    var request = new MockHttpServletRequest("GET", path);
    request.setServletPath(path);
    var chain = new MockFilterChain();
    new DemoFeatureFilter().doFilter(request, new MockHttpServletResponse(), chain);
    assertThat(chain.getRequest()).isSameAs(request);
  }
}
