package com.dike.identity.infrastructure.security;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class MobileSessionIdResolverTest {
  private final MobileSessionIdResolver resolver =
      new MobileSessionIdResolver(
          new org.springframework.session.web.http.CookieHttpSessionIdResolver());

  @Test
  void explicitBearerDoesNotFallBackToBrowserCookie() {
    var request = new MockHttpServletRequest();
    request.setCookies(new Cookie("SESSION", "YnJvd3Nlci1zZXNzaW9u"));
    request.addHeader("Authorization", "Bearer dike-mobile.00000000-0000-0000-0000-000000000000");
    assertThat(resolver.resolveSessionIds(request))
        .containsExactly("00000000-0000-0000-0000-000000000000");
    var response = new MockHttpServletResponse();
    resolver.setSessionId(request, response, "another");
    assertThat(response.getHeaders("Set-Cookie")).isEmpty();
  }

  @Test
  void browserStillUsesCookieAndCannotDisableCsrfWithMalformedBearer() {
    var request = new MockHttpServletRequest();
    request.setCookies(new Cookie("SESSION", "YnJvd3Nlci1zZXNzaW9u"));
    request.addHeader("Authorization", "Bearer bad");
    assertThat(MobileSessionIdResolver.isAuthenticatedMobileRequest(request)).isFalse();
    assertThat(resolver.resolveSessionIds(request)).isEmpty();
  }

  @Test
  void mobileExchangeIgnoresOAuthBrowserCookie() {
    var request = new MockHttpServletRequest("POST", "/api/v1/auth/mobile/exchange");
    request.setCookies(new Cookie("SESSION", "YnJvd3Nlci1zZXNzaW9u"));

    assertThat(resolver.resolveSessionIds(request)).isEmpty();
  }

  @Test
  void mobileGoogleBootstrapIgnoresStaleMobileCookie() {
    var request = new MockHttpServletRequest("GET", "/api/v1/auth/mobile/google");
    request.setCookies(new Cookie("SESSION", "YnJvd3Nlci1zZXNzaW9u"));

    assertThat(resolver.resolveSessionIds(request)).isEmpty();
  }
}
