package com.dike.shared.api;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import java.util.regex.Pattern;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestIdFilter extends OncePerRequestFilter {

  static final String REQUEST_ID_ATTRIBUTE = RequestIdFilter.class.getName() + ".requestId";
  static final String REQUEST_ID_HEADER = "X-Request-Id";
  static final String CORRELATION_ID_HEADER = "X-Correlation-Id";
  static final String CAUSATION_ID_HEADER = "X-Causation-Id";
  private static final Pattern SAFE_REQUEST_ID = Pattern.compile("[A-Za-z0-9._:-]{8,128}");

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {
    String requestId = sanitize(request.getHeader(REQUEST_ID_HEADER));
    String correlationId = sanitizeOrFallback(request.getHeader(CORRELATION_ID_HEADER), requestId);
    String causationId = sanitizeOrFallback(request.getHeader(CAUSATION_ID_HEADER), requestId);
    request.setAttribute(REQUEST_ID_ATTRIBUTE, requestId);
    response.setHeader(REQUEST_ID_HEADER, requestId);

    try (MDC.MDCCloseable ignoredRequest = MDC.putCloseable("requestId", requestId);
        MDC.MDCCloseable ignoredCorrelation = MDC.putCloseable("correlationId", correlationId);
        MDC.MDCCloseable ignoredCausation = MDC.putCloseable("causationId", causationId)) {
      filterChain.doFilter(request, response);
    }
  }

  private String sanitize(String candidate) {
    return candidate != null && SAFE_REQUEST_ID.matcher(candidate).matches()
        ? candidate
        : UUID.randomUUID().toString();
  }

  private String sanitizeOrFallback(String candidate, String fallback) {
    return candidate != null && SAFE_REQUEST_ID.matcher(candidate).matches() ? candidate : fallback;
  }
}
