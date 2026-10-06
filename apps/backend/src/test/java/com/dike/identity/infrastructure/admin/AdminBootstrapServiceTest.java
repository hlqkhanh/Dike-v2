package com.dike.identity.infrastructure.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.dike.shared.outbox.OutboxPublisher;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.MongoTemplate;

class AdminBootstrapServiceTest {

  private static final Instant NOW = Instant.parse("2026-10-06T00:00:00Z");
  private final MongoTemplate mongo = mock(MongoTemplate.class);
  private final OutboxPublisher outbox = mock(OutboxPublisher.class);
  private final AdminBootstrapService service =
      new AdminBootstrapService(mongo, outbox, Clock.fixed(NOW, ZoneOffset.UTC));

  @Test
  void dryRunDoesNotMutateOrPublishAuditEvent() {
    when(mongo.findById("user-1", Document.class, "users"))
        .thenReturn(new Document("_id", "user-1").append("assignedRoles", List.of()));

    var result = service.grant("user-1", "operator-1", "initial bootstrap", true);

    assertThat(result).isEqualTo(AdminBootstrapService.Result.WOULD_ASSIGN);
    verify(mongo, never()).findAndModify(any(), any(), any(), eq(Document.class), eq("users"));
    verify(outbox, never()).publish(any(), any(), any(), any(Integer.class), any());
  }

  @Test
  void existingAdminAssignmentIsIdempotent() {
    when(mongo.findById("user-1", Document.class, "users"))
        .thenReturn(new Document("_id", "user-1").append("assignedRoles", List.of("ADMIN")));

    var result = service.grant("user-1", "operator-1", "initial bootstrap", false);

    assertThat(result).isEqualTo(AdminBootstrapService.Result.ALREADY_ASSIGNED);
    verify(mongo, never()).findAndModify(any(), any(), any(), eq(Document.class), eq("users"));
    verify(outbox, never()).publish(any(), any(), any(), any(Integer.class), any());
  }

  @Test
  void assignmentIncrementsAuthorityVersionAndPublishesAudit() {
    when(mongo.findById("user-1", Document.class, "users"))
        .thenReturn(new Document("_id", "user-1").append("assignedRoles", List.of()));
    when(mongo.findAndModify(any(), any(), any(), eq(Document.class), eq("users")))
        .thenReturn(new Document("_id", "user-1").append("assignedRoles", List.of("ADMIN")));

    var result = service.grant("user-1", "operator-1", "initial bootstrap", false);

    assertThat(result).isEqualTo(AdminBootstrapService.Result.ASSIGNED);
    verify(outbox)
        .publish(
            "identity.admin-role-assigned",
            "UserAccount",
            "user-1",
            1,
            java.util.Map.of("operator", "operator-1", "reason", "initial bootstrap"));
  }
}
