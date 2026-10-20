package com.dike.identity.application;

import com.dike.identity.infrastructure.security.SessionAttributes;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.util.Collections;
import java.util.regex.Pattern;
import org.springframework.http.HttpHeaders;

/** Token encoding and authentication rules shared by mobile session entry points. */
public final class MobileSessionTokens {

  private MobileSessionTokens() {}

  private static final String PREFIX = "dike-mobile.";
  private static final Pattern SESSION_ID =
      Pattern.compile("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");

  public static String tokenFor(HttpSession session) {
    if (!Boolean.TRUE.equals(session.getAttribute(SessionAttributes.MOBILE))) {
      throw new IllegalArgumentException("A native session is required");
    }
    return tokenForSessionId(session.getId());
  }

  public static String tokenForSessionId(String sessionId) {
    return PREFIX + sessionId;
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

  public static String bearerSessionId(HttpServletRequest request) {
    var headers = Collections.list(request.getHeaders(HttpHeaders.AUTHORIZATION));
    if (headers.size() != 1) return null;
    String header = headers.getFirst();
    String scheme = "Bearer " + PREFIX;
    if (!header.regionMatches(true, 0, scheme, 0, scheme.length())) return null;
    String id = header.substring(scheme.length());
    return SESSION_ID.matcher(id).matches() ? id : null;
  }
}
