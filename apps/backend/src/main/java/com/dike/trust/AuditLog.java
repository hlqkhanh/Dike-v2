package com.dike.trust;

import java.time.Instant;
import java.util.Map;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("audit_logs")
public record AuditLog(
    @Id String id,
    String actorUserId,
    String actorRole,
    String action,
    String targetType,
    String targetId,
    String reportId,
    String reason,
    Map<String, String> safeBefore,
    Map<String, String> safeAfter,
    String requestId,
    Instant occurredAt) {}
