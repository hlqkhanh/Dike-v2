package com.dike.identity.infrastructure.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.web.filter.OncePerRequestFilter;

/** Public demos cannot issue upload grants, send SMS, or use developer login endpoints. */
final class DemoFeatureFilter extends OncePerRequestFilter {
  private final boolean routingEnabled;

  DemoFeatureFilter() {
    this(false);
  }

  DemoFeatureFilter(boolean routingEnabled) {
    this.routingEnabled = routingEnabled;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    String path = request.getServletPath();
    if (blocked(path, "/api/v1/files")
        || blocked(path, "/api/v1/auth/otp")
        || blocked(path, "/api/v1/auth/test")
        || blocked(path, "/api/v1/auth/dev")
        || (!routingEnabled && blocked(path, "/api/v1/routing"))) {
      SecurityErrorWriter.write(
          request,
          response,
          503,
          "DEMO_FEATURE_DISABLED",
          "Tính năng không có trong bản demo miễn phí");
      return;
    }
    chain.doFilter(request, response);
  }

  private boolean blocked(String path, String prefix) {
    return path.equals(prefix) || path.startsWith(prefix + "/");
  }
}
