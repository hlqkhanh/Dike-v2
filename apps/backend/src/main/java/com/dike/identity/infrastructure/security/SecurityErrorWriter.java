package com.dike.identity.infrastructure.security;

import com.dike.shared.api.RequestIdFilter;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.springframework.http.MediaType;

final class SecurityErrorWriter {

  private static final ObjectMapper JSON = new ObjectMapper();

  private SecurityErrorWriter() {}

  static void write(
      HttpServletRequest request,
      HttpServletResponse response,
      int status,
      String code,
      String message)
      throws IOException {
    Object requestId = request.getAttribute(RequestIdFilter.REQUEST_ID_ATTRIBUTE);
    response.setStatus(status);
    response.setCharacterEncoding(java.nio.charset.StandardCharsets.UTF_8.name());
    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Pragma", "no-cache");
    JSON.writeValue(
        response.getWriter(),
        Map.of(
            "error",
            Map.of(
                "code",
                code,
                "message",
                message,
                "requestId",
                requestId == null ? "unknown" : requestId.toString(),
                "fields",
                List.of())));
  }
}
