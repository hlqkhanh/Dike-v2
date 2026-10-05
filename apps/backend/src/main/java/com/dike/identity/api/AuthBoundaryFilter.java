package com.dike.identity.api;

import com.dike.identity.application.AuthService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URI;
import java.util.Set;
import org.springframework.web.filter.OncePerRequestFilter;

final class AuthBoundaryFilter extends OncePerRequestFilter {
  private final AuthSettings settings;
  private final AuthService auth;

  AuthBoundaryFilter(AuthSettings settings, AuthService auth) {
    this.settings = settings;
    this.auth = auth;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    if (request.getRequestURI().startsWith("/api/v1/auth/")) {
      response.setHeader("Cache-Control", "no-store");
      if (!Set.of("GET", "HEAD", "OPTIONS").contains(request.getMethod())
          && !validOrigin(request)) {
        response.setStatus(403);
        response.setContentType("application/json");
        response
            .getWriter()
            .write(
                "{\"error\":{\"code\":\"ORIGIN_NOT_ALLOWED\",\"message\":\"Request origin is not allowed\"}}");
        return;
      }
      if (request.getRequestURI().equals("/api/v1/auth/google")
          || request.getRequestURI().equals("/api/v1/auth/callback")) {
        try {
          auth.rateLimit(request.getRemoteAddr());
        } catch (RuntimeException e) {
          response.setStatus(e instanceof com.dike.shared.api.ApiException ? 429 : 503);
          response.setHeader("Retry-After", "60");
          response.setContentType("application/json");
          response
              .getWriter()
              .write("{\"error\":{\"code\":\"AUTH_UNAVAILABLE\",\"message\":\"Try again later\"}}");
          return;
        }
      }
    }
    chain.doFilter(request, response);
  }

  boolean validOrigin(HttpServletRequest request) {
    String origin = request.getHeader("Origin");
    if (origin != null) return origin.equals(settings.webUrl());
    String referer = request.getHeader("Referer");
    if (referer == null) return false;
    try {
      URI uri = URI.create(referer);
      return (uri.getScheme() + "://" + uri.getRawAuthority()).equals(settings.webUrl());
    } catch (IllegalArgumentException e) {
      return false;
    }
  }
}
