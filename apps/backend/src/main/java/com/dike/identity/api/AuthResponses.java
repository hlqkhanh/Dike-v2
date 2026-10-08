package com.dike.identity.api;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;

public final class AuthResponses {

  private AuthResponses() {}

  public record AuthSessionResponse(boolean authenticated, UserView user, SessionView session) {}

  @Schema(name = "AuthUser")
  public record UserView(
      String id,
      String displayName,
      String avatarUrl,
      String email,
      String onboardingStatus,
      String phoneStatus,
      String phoneMasked,
      long phoneVersion,
      String verificationEvidence,
      String driverApprovalEvidence,
      String accessMode,
      List<String> authorities,
      long authorizationVersion,
      String nextAction) {}

  @Schema(name = "AuthSession")
  public record SessionView(
      String id,
      String deviceLabel,
      Instant createdAt,
      Instant lastSeenAt,
      Instant idleExpiresAt,
      Instant absoluteExpiresAt,
      boolean current) {}

  public record SessionListResponse(List<SessionView> sessions) {}
}
