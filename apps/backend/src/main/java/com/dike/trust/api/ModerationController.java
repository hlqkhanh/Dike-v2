package com.dike.trust.api;

import com.dike.trust.AuditLog;
import com.dike.trust.Report;
import com.dike.trust.application.ModerationService;
import io.swagger.v3.oas.annotations.Operation;
import java.security.Principal;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class ModerationController {
  private final ModerationService service;

  public ModerationController(ModerationService service) {
    this.service = service;
  }

  public record Version(long version) {}

  public record Assignment(String userId, long version) {}

  public record Priority(String priority, long version) {}

  public record Enforcement(String reason) {}

  @PostMapping("/reports")
  @Operation(operationId = "createReport")
  Report submit(Principal p, @RequestBody ModerationService.CreateReport body) {
    return service.submit(p.getName(), body);
  }

  @GetMapping("/reports/{id}/status")
  @Operation(operationId = "getReportStatus")
  Report status(Principal p, @PathVariable String id) {
    return service.status(p.getName(), id);
  }

  @GetMapping("/admin/reports")
  @Operation(operationId = "listAdminReports")
  List<Report> reports(
      Principal p,
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String priority,
      @RequestParam(required = false) String cursor,
      @RequestParam(defaultValue = "20") int limit) {
    return service.reports(p.getName(), status, priority, cursor, limit);
  }

  @GetMapping("/admin/reports/{id}")
  @Operation(operationId = "getAdminReport")
  Report detail(Principal p, @PathVariable String id) {
    return service.detail(p.getName(), id);
  }

  @PostMapping("/admin/reports/{id}/claim")
  @Operation(operationId = "claimAdminReport")
  Report claim(Principal p, @PathVariable String id, @RequestBody Version body) {
    return service.claim(p.getName(), id, body.version());
  }

  @PutMapping("/admin/reports/{id}/assignment")
  @Operation(operationId = "assignAdminReport")
  Report assign(Principal p, @PathVariable String id, @RequestBody Assignment body) {
    return service.assign(p.getName(), id, body.userId(), body.version());
  }

  @PutMapping("/admin/reports/{id}/priority")
  @Operation(operationId = "prioritizeAdminReport")
  Report priority(Principal p, @PathVariable String id, @RequestBody Priority body) {
    return service.priority(p.getName(), id, body.priority(), body.version());
  }

  @PostMapping("/admin/reports/{id}/transitions")
  @Operation(operationId = "transitionAdminReport")
  Report transition(
      Principal p, @PathVariable String id, @RequestBody ModerationService.Transition body) {
    return service.transition(p.getName(), id, body);
  }

  @PostMapping("/admin/users/{id}/lock")
  @Operation(operationId = "lockUser")
  long lock(Principal p, @PathVariable String id, @RequestBody Enforcement body) {
    return service.lock(p.getName(), id, true, body.reason());
  }

  @PostMapping("/admin/users/{id}/unlock")
  @Operation(operationId = "unlockUser")
  long unlock(Principal p, @PathVariable String id, @RequestBody Enforcement body) {
    return service.lock(p.getName(), id, false, body.reason());
  }

  @GetMapping("/admin/audit")
  @Operation(operationId = "listAuditLog")
  List<AuditLog> audit(
      Principal p,
      @RequestParam(required = false) String cursor,
      @RequestParam(defaultValue = "50") int limit) {
    return service.audit(p.getName(), cursor, limit);
  }
}
