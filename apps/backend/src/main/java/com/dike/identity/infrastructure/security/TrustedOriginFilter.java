package com.dike.identity.infrastructure.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URI;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.http.HttpMethod;
import org.springframework.web.filter.OncePerRequestFilter;

final class TrustedOriginFilter extends OncePerRequestFilter {

  private final Set<String> allowedOrigins;

  TrustedOriginFilter(IdentityProperties properties) {
    this.allowedOrigins =
        properties.allowedOrigins().stream()
            .map(TrustedOriginFilter::origin)
            .collect(Collectors.toSet());
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {
    if (isSafe(request.getMethod())) {
      filterChain.doFilter(request, response);
      return;
    }

    String candidate = request.getHeader("Origin");
    if (candidate == null || candidate.isBlank()) {
      candidate = request.getHeader("Referer");
    }
    if (candidate == null || !isAllowed(candidate)) {
      SecurityErrorWriter.write(
          request,
          response,
          HttpServletResponse.SC_FORBIDDEN,
          "ORIGIN_NOT_ALLOWED",
          "Nguồn yêu cầu không được phép");
      return;
    }
    filterChain.doFilter(request, response);
  }

  private boolean isAllowed(String candidate) {
    try {
      return allowedOrigins.contains(origin(URI.create(candidate)));
    } catch (IllegalArgumentException exception) {
      return false;
    }
  }

  private static boolean isSafe(String method) {
    return HttpMethod.GET.matches(method)
        || HttpMethod.HEAD.matches(method)
        || HttpMethod.OPTIONS.matches(method)
        || HttpMethod.TRACE.matches(method);
  }

  private static String origin(URI uri) {
    if (uri.getScheme() == null || uri.getHost() == null) {
      throw new IllegalArgumentException("Origin must be absolute");
    }
    int port = uri.getPort();
    String authority = port < 0 ? uri.getHost() : uri.getHost() + ":" + port;
    return uri.getScheme() + "://" + authority;
  }
}
