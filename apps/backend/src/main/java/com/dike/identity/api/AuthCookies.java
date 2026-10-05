package com.dike.identity.api;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseCookie;

final class AuthCookies {
  private AuthCookies() {}

  static String credential(HttpServletRequest request) {
    if (request.getCookies() != null)
      for (Cookie cookie : request.getCookies())
        if (cookie.getName().equals("DIKE_SESSION")) return cookie.getValue();
    return null;
  }

  static void write(HttpServletResponse response, String value, boolean secure) {
    response.addHeader(
        "Set-Cookie",
        ResponseCookie.from("DIKE_SESSION", value)
            .httpOnly(true)
            .secure(secure)
            .sameSite("Lax")
            .path("/")
            .build()
            .toString());
  }

  static void clear(HttpServletResponse response, boolean secure) {
    response.addHeader(
        "Set-Cookie",
        ResponseCookie.from("DIKE_SESSION", "")
            .httpOnly(true)
            .secure(secure)
            .sameSite("Lax")
            .path("/")
            .maxAge(0)
            .build()
            .toString());
  }
}
