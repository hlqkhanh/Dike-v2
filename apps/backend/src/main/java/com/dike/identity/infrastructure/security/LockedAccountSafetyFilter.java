package com.dike.identity.infrastructure.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

final class LockedAccountSafetyFilter extends OncePerRequestFilter {
  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    var authentication = SecurityContextHolder.getContext().getAuthentication();
    boolean locked =
        authentication != null
            && authentication.getAuthorities().stream()
                .anyMatch(authority -> "LOCKED_ACCOUNT".equals(authority.getAuthority()));
    if (!locked || allowed(request)) {
      chain.doFilter(request, response);
      return;
    }
    SecurityErrorWriter.write(
        request,
        response,
        HttpServletResponse.SC_FORBIDDEN,
        "ACCOUNT_LOCKED",
        "Tài khoản đang ở chế độ an toàn");
  }

  private boolean allowed(HttpServletRequest request) {
    String path = request.getRequestURI();
    String method = request.getMethod();
    if (path.startsWith("/api/v1/auth/") || path.startsWith("/api/v1/reports")) return true;
    if (path.startsWith("/api/v1/notifications") && "GET".equals(method)) return true;
    if (path.matches("/api/v1/bookings/[^/]+") && "GET".equals(method)) return true;
    if (path.matches("/api/v1/trips/[^/]+") && "GET".equals(method)) return true;
    if (path.matches("/api/v1/bookings/[^/]+/actions") && "POST".equals(method)) return true;
    if (path.contains("/live-location")) return true;
    return path.startsWith("/api/v1/conversations/")
        && ("GET".equals(method) || path.endsWith("/messages"));
  }
}
