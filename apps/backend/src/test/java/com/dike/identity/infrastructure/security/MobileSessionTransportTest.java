package com.dike.identity.infrastructure.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.dike.identity.application.AccessMode;
import com.dike.identity.application.AccountAccessService;
import com.dike.identity.application.AccountAccessSnapshot;
import com.dike.identity.application.DriverApprovalEvidence;
import com.dike.identity.domain.AccountStatus;
import com.dike.identity.domain.VerificationEvidence;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;
import org.springframework.session.MapSession;
import org.springframework.session.MapSessionRepository;
import org.springframework.session.web.http.CookieHttpSessionIdResolver;
import org.springframework.session.web.http.DefaultCookieSerializer;
import org.springframework.session.web.http.SessionRepositoryFilter;

class MobileSessionTransportTest {
  private final MapSessionRepository repository =
      new MapSessionRepository(new ConcurrentHashMap<>());
  private final SessionRepositoryFilter<MapSession> sessions =
      new SessionRepositoryFilter<>(repository);
  private final AccountAccessService access = mock(AccountAccessService.class);
  private final MobileSessionIdResolver resolver;

  MobileSessionTransportTest() {
    var serializer = new DefaultCookieSerializer();
    serializer.setCookieName("DIKE_SESSION");
    var cookies = new CookieHttpSessionIdResolver();
    cookies.setCookieSerializer(serializer);
    this.resolver = new MobileSessionIdResolver(cookies);
    sessions.setHttpSessionIdResolver(resolver);
    when(access.require("member-id"))
        .thenReturn(
            new AccountAccessSnapshot(
                "member-id",
                AccountStatus.ACTIVE,
                Set.of(),
                VerificationEvidence.SIMULATED,
                DriverApprovalEvidence.NONE,
                AccessMode.SIMULATED,
                1));
  }

  @Test
  void nativeLoginPersistsSessionWithoutCookiesAndLogoutRevokesTokenWithoutCsrf() throws Exception {
    var login = send("GET", "/api/v1/auth/dev/mobile", null, null, null);
    String token = login.getContentAsString();
    assertThat(login.getHeaders("Set-Cookie")).isEmpty();
    assertThat(login.getHeader("Cache-Control")).isEqualTo("no-store");
    assertThat(send("GET", "/private", token, null, null).getStatus()).isEqualTo(200);

    var logout = send("POST", "/logout", token, null, null);
    assertThat(logout.getStatus()).isEqualTo(204);
    assertThat(logout.getHeaders("Set-Cookie")).isEmpty();
    assertThat(send("GET", "/private", token, null, null).getStatus()).isEqualTo(401);
  }

  @Test
  void rejectsExpiredNativeSessionAndRotatesCredentialsWithoutCookies() throws Exception {
    String token = send("GET", "/api/v1/auth/dev/mobile", null, null, null).getContentAsString();
    var rotated = send("POST", "/rotate", token, null, null);
    String nextToken = rotated.getHeader(MobileSessionIdResolver.TOKEN_HEADER);
    assertThat(nextToken).isNotNull().isNotEqualTo(token);
    assertThat(rotated.getHeaders("Set-Cookie")).isEmpty();
    assertThat(send("GET", "/private", token, null, null).getStatus()).isEqualTo(401);
    assertThat(send("GET", "/private", nextToken, null, null).getStatus()).isEqualTo(200);
    var expired = repository.findById(nextToken.substring("dike-mobile.".length()));
    expired.setLastAccessedTime(Instant.now().minus(Duration.ofDays(2)));
    expired.setMaxInactiveInterval(Duration.ofMinutes(1));
    repository.save(expired);
    assertThat(send("GET", "/private", nextToken, null, null).getStatus()).isEqualTo(401);
  }

  @Test
  void browserSessionCannotBeReplayedAsBearerAndStillRequiresOriginAndCsrf() throws Exception {
    var login = send("GET", "/login-web", null, null, null);
    Cookie cookie = login.getCookie("DIKE_SESSION");
    assertThat(cookie).isNotNull();
    String sessionId =
        new String(Base64.getDecoder().decode(cookie.getValue()), StandardCharsets.UTF_8);
    assertThat(send("GET", "/private", "dike-mobile." + sessionId, null, null).getStatus())
        .isEqualTo(401);
    assertThat(send("GET", "/private", null, cookie, null).getStatus()).isEqualTo(200);
    assertThat(send("POST", "/logout", null, cookie, null).getStatus()).isEqualTo(403);
    assertThat(send("POST", "/logout", null, cookie, "http://localhost:3000").getStatus())
        .isEqualTo(403);
  }

  @Test
  void nativeSessionCannotBeReplayedAsCookieAndInvalidBearerDoesNotFallBackToCookie()
      throws Exception {
    String token = send("GET", "/api/v1/auth/dev/mobile", null, null, null).getContentAsString();
    String sessionId = token.substring("dike-mobile.".length());
    var nativeCookie =
        new Cookie(
            "DIKE_SESSION",
            Base64.getEncoder().encodeToString(sessionId.getBytes(StandardCharsets.UTF_8)));
    var replayResponse = send("GET", "/private", null, nativeCookie, null);
    assertThat(replayResponse.getStatus()).isEqualTo(401);
    assertThat(replayResponse.getHeader("Set-Cookie")).contains("Max-Age=0");
    assertThat(send("GET", "/private", token, null, null).getStatus()).isEqualTo(200);

    var webCookie = send("GET", "/login-web", null, null, null).getCookie("DIKE_SESSION");
    assertThat(send("GET", "/private", "invalid", webCookie, null).getStatus()).isEqualTo(401);
  }

  @Test
  void nativeBootstrapLeavesExistingBrowserSessionAlive() throws Exception {
    Cookie webCookie = send("GET", "/login-web", null, null, null).getCookie("DIKE_SESSION");
    var mobile = send("GET", "/api/v1/auth/dev/mobile", null, webCookie, null);
    assertThat(mobile.getHeaders("Set-Cookie")).isEmpty();
    assertThat(send("GET", "/private", null, webCookie, null).getStatus()).isEqualTo(200);
    assertThat(send("GET", "/private", mobile.getContentAsString(), null, null).getStatus())
        .isEqualTo(200);
  }

  private MockHttpServletResponse send(
      String method, String path, String token, Cookie cookie, String origin) throws Exception {
    SecurityContextHolder.clearContext();
    var request = new MockHttpServletRequest(method, path);
    if (token != null) request.addHeader("Authorization", "Bearer " + token);
    if (cookie != null) request.setCookies(cookie);
    if (origin != null) request.addHeader("Origin", origin);
    var response = new MockHttpServletResponse();
    var properties =
        new IdentityProperties(
            URI.create("http://localhost:3000"),
            List.of(URI.create("http://localhost:3000")),
            false,
            new IdentityProperties.Session(
                Duration.ofHours(24), Duration.ofDays(30), Duration.ofMinutes(5), 10),
            new IdentityProperties.Cookie("DIKE_SESSION", false, "Lax"),
            new IdentityProperties.Google("https://accounts.google.com", "google"));
    var csrf = new CsrfFilter(new HttpSessionCsrfTokenRepository());
    csrf.setRequireCsrfProtectionMatcher(
        candidate ->
            CsrfFilter.DEFAULT_CSRF_MATCHER.matches(candidate)
                && !MobileSessionIdResolver.isAuthenticatedMobileRequest(candidate));
    try {
      sessions.doFilter(
          request,
          response,
          new MockFilterChain(
              new TestEndpoints(),
              new AccountAuthenticationFilter(access, resolver),
              new TrustedOriginFilter(properties),
              csrf,
              new AuthNoStoreFilter()));
      return response;
    } finally {
      SecurityContextHolder.clearContext();
    }
  }

  private static final class TestEndpoints extends HttpServlet {
    @Override
    protected void service(HttpServletRequest request, HttpServletResponse response)
        throws IOException {
      String path = request.getRequestURI();
      if (path.equals("/login-web") || path.equals("/api/v1/auth/dev/mobile")) {
        var session = request.getSession(true);
        session.setAttribute(SessionAttributes.ACCOUNT_ID, "member-id");
        if (path.endsWith("/mobile")) {
          session.setAttribute(SessionAttributes.MOBILE, true);
          response.getWriter().write(MobileSessionIdResolver.tokenFor(session));
        }
      } else if (SecurityContextHolder.getContext().getAuthentication() == null) {
        response.setStatus(401);
      } else if (path.equals("/logout")) {
        request.getSession(false).invalidate();
        response.setStatus(204);
      } else if (path.equals("/rotate")) {
        request.changeSessionId();
      }
    }
  }
}
