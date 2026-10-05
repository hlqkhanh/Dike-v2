package com.dike.shared.api;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class RequestIdFilterTest {

  private final RequestIdFilter filter = new RequestIdFilter();

  @Test
  void acceptsSafeRequestIdAndPropagatesCorrelationDuringRequest() throws Exception {
    MockHttpServletRequest request = new MockHttpServletRequest();
    request.addHeader(RequestIdFilter.REQUEST_ID_HEADER, "request-12345678");
    request.addHeader(RequestIdFilter.CORRELATION_ID_HEADER, "correlation-12345678");
    MockHttpServletResponse response = new MockHttpServletResponse();
    FilterChain chain =
        (ignoredRequest, ignoredResponse) -> {
          assertThat(MDC.get("requestId")).isEqualTo("request-12345678");
          assertThat(MDC.get("correlationId")).isEqualTo("correlation-12345678");
        };

    filter.doFilter(request, response, chain);

    assertThat(response.getHeader(RequestIdFilter.REQUEST_ID_HEADER)).isEqualTo("request-12345678");
    assertThat(MDC.get("requestId")).isNull();
  }

  @Test
  void replacesUnsafeHeader() throws Exception {
    MockHttpServletRequest request = new MockHttpServletRequest();
    request.addHeader(RequestIdFilter.REQUEST_ID_HEADER, "bad header\nvalue");
    MockHttpServletResponse response = new MockHttpServletResponse();

    filter.doFilter(request, response, (ignoredRequest, ignoredResponse) -> {});

    assertThat(response.getHeader(RequestIdFilter.REQUEST_ID_HEADER))
        .matches("[0-9a-f-]{36}")
        .doesNotContain("bad header");
  }
}
