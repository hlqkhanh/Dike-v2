package com.dike.identity.infrastructure.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.web.filter.OncePerRequestFilter;

final class AuthNoStoreFilter extends OncePerRequestFilter {

  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    String path = request.getRequestURI();
    return !(path.startsWith("/api/v1/auth/")
        || path.startsWith("/api/v1/me/")
        || path.startsWith("/api/v1/users")
        || path.startsWith("/api/v1/friendships")
        || path.startsWith("/api/v1/blocks")
        || path.startsWith("/api/v1/social/")
        || path.startsWith("/api/v1/files/")
        || path.startsWith("/api/v1/ride-")
        || path.startsWith("/api/v1/saved-posts")
        || path.startsWith("/api/v1/trips")
        || path.startsWith("/api/v1/proposals")
        || path.startsWith("/api/v1/bookings")
        || path.startsWith("/api/v1/reports"));
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Pragma", "no-cache");
    filterChain.doFilter(request, response);
  }
}
