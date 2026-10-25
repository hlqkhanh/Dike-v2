package com.dike.identity.infrastructure.security;

import com.dike.identity.application.MobileSessionTokens;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.util.List;
import org.springframework.session.web.http.CookieHttpSessionIdResolver;
import org.springframework.session.web.http.HttpSessionIdResolver;

/** Keeps native bearer credentials separate from browser session cookies. */
public final class MobileSessionIdResolver implements HttpSessionIdResolver {

  public static final String TOKEN_HEADER = "X-Dike-Mobile-Token";
  private final CookieHttpSessionIdResolver cookies;

  public MobileSessionIdResolver(CookieHttpSessionIdResolver cookies) {
    this.cookies = cookies;
  }

  @Override
  public List<String> resolveSessionIds(HttpServletRequest request) {
    // Starting a local native session must not replace a browser's existing session.
    if ("/api/v1/auth/dev/mobile".equals(request.getRequestURI())
        || "/api/v1/auth/mobile/google".equals(request.getRequestURI())
        || "/api/v1/auth/mobile/exchange".equals(request.getRequestURI())) {
      return List.of();
    }
    if (hasAuthorizationHeader(request)) {
      String id = MobileSessionTokens.bearerSessionId(request);
      return id == null ? List.of() : List.of(id);
    }
    return cookies.resolveSessionIds(request);
  }

  @Override
  public void setSessionId(
      HttpServletRequest request, HttpServletResponse response, String sessionId) {
    HttpSession session = request.getSession(false);
    if (session != null && Boolean.TRUE.equals(session.getAttribute(SessionAttributes.MOBILE))) {
      response.setHeader(TOKEN_HEADER, MobileSessionTokens.tokenForSessionId(sessionId));
    } else if (!hasAuthorizationHeader(request)) {
      cookies.setSessionId(request, response, sessionId);
    }
  }

  @Override
  public void expireSession(HttpServletRequest request, HttpServletResponse response) {
    if (hasAuthorizationHeader(request)) {
      response.setHeader(TOKEN_HEADER, "");
    } else {
      cookies.expireSession(request, response);
    }
  }

  public static String tokenFor(HttpSession session) {
    return MobileSessionTokens.tokenFor(session);
  }

  public static boolean hasAuthorizationHeader(HttpServletRequest request) {
    return MobileSessionTokens.hasAuthorizationHeader(request);
  }

  public static boolean isAuthenticatedMobileRequest(HttpServletRequest request) {
    return MobileSessionTokens.isAuthenticatedMobileRequest(request);
  }
}
