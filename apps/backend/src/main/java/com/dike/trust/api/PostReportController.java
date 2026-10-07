package com.dike.trust.api;

import com.dike.trust.application.PostReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import java.security.Principal;
import org.springframework.web.bind.annotation.*;

@RestController
@SecurityRequirement(name = "sessionCookie")
public class PostReportController {
  private final PostReportService service;

  public PostReportController(PostReportService service) {
    this.service = service;
  }

  @PostMapping("/api/v1/reports")
  @Operation(operationId = "reportRidePost")
  public PostReportService.Receipt report(
      Principal p,
      @RequestBody PostReportService.Input body,
      @RequestHeader("Idempotency-Key") String key) {
    return service.report(p.getName(), body, key);
  }
}
