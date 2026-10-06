package com.dike.shared.api;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.http.HttpStatus;
import tools.jackson.databind.json.JsonMapper;

/** Error contract for failures that occur before MVC exception handling. */
public final class ApiErrorWriter {
  private static final JsonMapper JSON = JsonMapper.builder().build();

  private ApiErrorWriter() {}

  public static void write(
      HttpServletRequest request,
      HttpServletResponse response,
      HttpStatus status,
      String code,
      String message)
      throws IOException {
    response.setStatus(status.value());
    response.setContentType("application/json");
    response.setCharacterEncoding("UTF-8");
    response.setHeader("Cache-Control", "no-store");
    if (status == HttpStatus.TOO_MANY_REQUESTS) response.setHeader("Retry-After", "60");
    Object id = request.getAttribute(RequestIdFilter.REQUEST_ID_ATTRIBUTE);
    JSON.writeValue(
        response.getWriter(),
        new ErrorResponse(
            new ErrorResponse.ErrorBody(
                code, message, id == null ? "unknown" : id.toString(), List.of())));
  }
}
