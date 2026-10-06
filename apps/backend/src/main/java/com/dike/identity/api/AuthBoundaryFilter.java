package com.dike.identity.api;

import com.dike.identity.application.AuthService;
import com.dike.shared.api.ApiErrorWriter;
import com.dike.shared.api.ApiException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URI;
import java.util.Set;
import org.springframework.http.HttpStatus;
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
        ApiErrorWriter.write(
            request,
            response,
            HttpStatus.FORBIDDEN,
            "ORIGIN_NOT_ALLOWED",
            "Request origin is not allowed");
        return;
      }
      if (request.getRequestURI().equals("/api/v1/auth/google")
          || request.getRequestURI().equals("/api/v1/auth/callback")) {
        try {
          auth.rateLimit(request.getRemoteAddr());
        } catch (ApiException e) {
          ApiErrorWriter.write(request, response, e.status(), e.code(), e.getMessage());
          return;
        } catch (RuntimeException e) {
          ApiErrorWriter.write(
              request,
              response,
              HttpStatus.SERVICE_UNAVAILABLE,
              "AUTH_UNAVAILABLE",
              "Try again later");
          return;
        }
      }
    }
    try {
      chain.doFilter(request, response);
    } catch (org.springframework.dao.DataAccessException e) {
      if (response.isCommitted()) throw e;
      ApiErrorWriter.write(
          request,
          response,
          HttpStatus.SERVICE_UNAVAILABLE,
          "DEPENDENCY_UNAVAILABLE",
          "Service temporarily unavailable");
    }
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
