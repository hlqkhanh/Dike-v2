package com.dike.identity.infrastructure.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.util.Collections;
import java.util.List;
import java.util.regex.Pattern;
import org.springframework.http.HttpHeaders;
import org.springframework.session.web.http.CookieHttpSessionIdResolver;
import org.springframework.session.web.http.HttpSessionIdResolver;

/** Keeps native bearer credentials separate from browser session cookies. */
public final class MobileSessionIdResolver implements HttpSessionIdResolver {

  public static final String TOKEN_HEADER = "X-Dike-Mobile-Token";
  private static final String PREFIX = "dike-mobile.";
  private static final Pattern SESSION_ID =
      Pattern.compile("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");
  private final CookieHttpSessionIdResolver cookies;

  public MobileSessionIdResolver(CookieHttpSessionIdResolver cookies) {
    this.cookies = cookies;
  }

  @Override
  public List<String> resolveSessionIds(HttpServletRequest request) {
    // Starting a local native session must not replace a browser's existing session.
    if ("/api/v1/auth/dev/mobile".equals(request.getRequestURI())) return List.of();
    if (hasAuthorizationHeader(request)) {
      String id = bearerSessionId(request);
      return id == null ? List.of() : List.of(id);
    }
    return cookies.resolveSessionIds(request);
  }

  @Override
  public void setSessionId(
      HttpServletRequest request, HttpServletResponse response, String sessionId) {
    HttpSession session = request.getSession(false);
    if (session != null && Boolean.TRUE.equals(session.getAttribute(SessionAttributes.MOBILE))) {
      response.setHeader(TOKEN_HEADER, PREFIX + sessionId);
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
    if (!Boolean.TRUE.equals(session.getAttribute(SessionAttributes.MOBILE))) {
      throw new IllegalArgumentException("A native session is required");
    }
    return PREFIX + session.getId();
  }

  public static boolean hasAuthorizationHeader(HttpServletRequest request) {
    return request.getHeader(HttpHeaders.AUTHORIZATION) != null;
  }

  public static boolean isAuthenticatedMobileRequest(HttpServletRequest request) {
    String id = bearerSessionId(request);
    if (id == null) return false;
    HttpSession session = request.getSession(false);
    return session != null
        && id.equals(session.getId())
        && Boolean.TRUE.equals(session.getAttribute(SessionAttributes.MOBILE))
        && session.getAttribute(SessionAttributes.ACCOUNT_ID) != null;
  }

  private static String bearerSessionId(HttpServletRequest request) {
    var headers = Collections.list(request.getHeaders(HttpHeaders.AUTHORIZATION));
    if (headers.size() != 1) return null;
    String header = headers.getFirst();
    String scheme = "Bearer " + PREFIX;
    if (!header.regionMatches(true, 0, scheme, 0, scheme.length())) return null;
    String id = header.substring(scheme.length());
    return SESSION_ID.matcher(id).matches() ? id : null;
  }
}
