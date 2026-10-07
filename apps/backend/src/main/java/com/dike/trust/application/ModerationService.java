package com.dike.trust.application;

import com.dike.identity.IdentityAccess;
import com.dike.identity.IdentityModeration;
import com.dike.shared.api.ApiException;
import com.dike.trust.AuditLog;
import com.dike.trust.Report;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ModerationService {
  private final MongoTemplate mongo;
  private final IdentityAccess identities;
  private final IdentityModeration accounts;
  private final Clock clock;

  public ModerationService(
      MongoTemplate mongo, IdentityAccess identities, IdentityModeration accounts, Clock clock) {
    this.mongo = mongo;
    this.identities = identities;
    this.accounts = accounts;
    this.clock = clock;
  }

  public record CreateReport(
      String targetType,
      String targetId,
      String postId,
      String contextBookingId,
      String reason,
      String note) {}

  public record Transition(String status, String resolutionCode, String note, long version) {}

  @Transactional
  public Report submit(String actor, CreateReport request) {
    String targetId = request.targetId();
    String type = request.targetType();
    boolean legacy = request.postId() != null && !request.postId().isBlank();
    boolean modern = targetId != null && !targetId.isBlank();
    if (legacy == modern) throw invalid("REPORT_INVALID_TARGET");
    if (legacy) {
      type = "POST";
      targetId = request.postId();
    }
    Report.TargetType targetType;
    Report.Reason reason;
    try {
      targetType = Report.TargetType.valueOf(type);
      reason = Report.Reason.valueOf(request.reason());
    } catch (RuntimeException exception) {
      throw invalid("REPORT_INVALID_TARGET");
    }
    if (targetType == Report.TargetType.USER && actor.equals(targetId))
      throw invalid("REPORT_INVALID_TARGET");
    if (request.note() != null && request.note().length() > 2000)
      throw invalid("REPORT_INVALID_TARGET");
    Instant now = clock.instant();
    Report report =
        new Report(
            UUID.randomUUID().toString(),
            actor,
            targetType,
            targetId,
            request.contextBookingId(),
            reason,
            request.note() == null ? null : request.note().trim(),
            Report.Status.RECEIVED,
            reason == Report.Reason.UNSAFE ? Report.Priority.P1 : Report.Priority.P2,
            null,
            Map.of("targetType", targetType.name(), "targetId", targetId),
            null,
            null,
            now,
            now,
            null,
            0);
    try {
      return mongo.insert(report);
    } catch (DuplicateKeyException duplicate) {
      throw conflict("REPORT_ALREADY_OPEN");
    }
  }

  public Report status(String actor, String id) {
    Report report = mongo.findById(id, Report.class);
    if (report == null || !report.reporterId().equals(actor)) throw missing();
    return new Report(
        report.id(),
        report.reporterId(),
        report.targetType(),
        report.targetId(),
        report.contextBookingId(),
        report.reason(),
        null,
        report.status(),
        report.priority(),
        null,
        Map.of(),
        null,
        null,
        report.createdAt(),
        report.updatedAt(),
        report.resolvedAt(),
        report.version());
  }

  public List<Report> reports(
      String actor, String status, String priority, String cursor, int limit) {
    requireModerator(actor);
    if (limit < 1 || limit > 50) throw invalid("INVALID_PAGE");
    List<Criteria> filters = new java.util.ArrayList<>();
    if (status != null) filters.add(Criteria.where("status").is(status));
    if (priority != null) filters.add(Criteria.where("priority").is(priority));
    if (cursor != null) filters.add(Criteria.where("_id").lt(cursor));
    Criteria criteria = filters.isEmpty() ? new Criteria() : new Criteria().andOperator(filters);
    return mongo.find(
        Query.query(criteria).with(Sort.by(Sort.Direction.DESC, "_id")).limit(limit), Report.class);
  }

  public Report detail(String actor, String id) {
    requireModerator(actor);
    Report value = mongo.findById(id, Report.class);
    if (value == null) throw missing();
    return value;
  }

  @Transactional
  public Report claim(String actor, String id, long version) {
    requireModerator(actor);
    return mutate(
        actor,
        id,
        version,
        new Update().set("assignedTo", actor).set("status", Report.Status.IN_REVIEW),
        "REPORT_CLAIMED",
        null);
  }

  @Transactional
  public Report assign(String actor, String id, String assignee, long version) {
    requireAdmin(actor);
    var target = identities.require(assignee);
    if (!target.moderator() && !target.admin()) throw invalid("REPORT_ASSIGNMENT_FORBIDDEN");
    return mutate(
        actor, id, version, new Update().set("assignedTo", assignee), "REPORT_ASSIGNED", null);
  }

  @Transactional
  public Report priority(String actor, String id, String priority, long version) {
    requireModerator(actor);
    Report.Priority value;
    try {
      value = Report.Priority.valueOf(priority);
    } catch (RuntimeException exception) {
      throw invalid("REPORT_TRANSITION_INVALID");
    }
    return mutate(
        actor, id, version, new Update().set("priority", value), "REPORT_PRIORITY_CHANGED", null);
  }

  @Transactional
  public Report transition(String actor, String id, Transition input) {
    requireModerator(actor);
    Report before = detail(actor, id);
    Report.Status target;
    try {
      target = Report.Status.valueOf(input.status());
    } catch (RuntimeException exception) {
      throw invalid("REPORT_TRANSITION_INVALID");
    }
    if (!allowed(before.status(), target)) throw conflict("REPORT_TRANSITION_INVALID");
    if ((target == Report.Status.RESOLVED || target == Report.Status.DISMISSED)
        && (input.resolutionCode() == null
            || input.resolutionCode().isBlank()
            || input.note() == null
            || input.note().isBlank())) throw invalid("REPORT_TRANSITION_INVALID");
    Update update =
        new Update()
            .set("status", target)
            .set("resolutionCode", input.resolutionCode())
            .set("resolutionNote", input.note());
    if (target == Report.Status.RESOLVED || target == Report.Status.DISMISSED)
      update.set("resolvedAt", clock.instant());
    else update.unset("resolvedAt");
    return mutate(actor, id, input.version(), update, "REPORT_TRANSITIONED", input.note());
  }

  @Transactional
  public long lock(String actor, String target, boolean locked, String reason) {
    requireAdmin(actor);
    long version = accounts.setLocked(actor, target, locked, reason);
    audit(
        actor,
        locked ? "ACCOUNT_LOCKED" : "ACCOUNT_UNLOCKED",
        "USER",
        target,
        null,
        reason,
        Map.of("authorizationVersion", Long.toString(version)));
    return version;
  }

  public List<AuditLog> audit(String actor, String cursor, int limit) {
    requireAdmin(actor);
    Criteria criteria = cursor == null ? new Criteria() : Criteria.where("_id").lt(cursor);
    return mongo.find(
        Query.query(criteria)
            .with(Sort.by(Sort.Direction.DESC, "_id"))
            .limit(Math.min(Math.max(limit, 1), 100)),
        AuditLog.class);
  }

  private Report mutate(
      String actor, String id, long version, Update update, String action, String reason) {
    Report before = mongo.findById(id, Report.class);
    if (before == null) throw missing();
    update.inc("version", 1).set("updatedAt", clock.instant());
    if (mongo
            .updateFirst(
                Query.query(Criteria.where("_id").is(id).and("version").is(version)),
                update,
                Report.class)
            .getModifiedCount()
        != 1) throw conflict("MODERATION_VERSION_CONFLICT");
    Report after = mongo.findById(id, Report.class);
    audit(
        actor,
        action,
        "REPORT",
        id,
        id,
        reason,
        Map.of("status", after.status().name(), "version", Long.toString(after.version())));
    return after;
  }

  private void audit(
      String actor,
      String action,
      String type,
      String target,
      String report,
      String reason,
      Map<String, String> after) {
    mongo.insert(
        new AuditLog(
            UUID.randomUUID().toString(),
            actor,
            identities.require(actor).admin() ? "ADMIN" : "MODERATOR",
            action,
            type,
            target,
            report,
            reason,
            Map.of(),
            after,
            org.slf4j.MDC.get("correlationId"),
            clock.instant()));
  }

  private boolean allowed(Report.Status before, Report.Status after) {
    return switch (before) {
      case RECEIVED -> after == Report.Status.TRIAGED || after == Report.Status.IN_REVIEW;
      case TRIAGED -> after == Report.Status.IN_REVIEW;
      case IN_REVIEW -> after == Report.Status.RESOLVED || after == Report.Status.DISMISSED;
      case RESOLVED, DISMISSED -> after == Report.Status.IN_REVIEW;
    };
  }

  private void requireModerator(String actor) {
    var access = identities.require(actor);
    if (!access.moderator() && !access.admin()) throw forbidden();
  }

  private void requireAdmin(String actor) {
    if (!identities.require(actor).admin()) throw forbidden();
  }

  private static ApiException invalid(String code) {
    return new ApiException(HttpStatus.BAD_REQUEST, code, "Yêu cầu kiểm duyệt không hợp lệ");
  }

  private static ApiException conflict(String code) {
    return new ApiException(HttpStatus.CONFLICT, code, "Trạng thái kiểm duyệt đã thay đổi");
  }

  private static ApiException forbidden() {
    return new ApiException(
        HttpStatus.FORBIDDEN, "MODERATION_FORBIDDEN", "Không có quyền kiểm duyệt");
  }

  private static ApiException missing() {
    return new ApiException(HttpStatus.NOT_FOUND, "REPORT_NOT_FOUND", "Không tìm thấy báo cáo");
  }
}
