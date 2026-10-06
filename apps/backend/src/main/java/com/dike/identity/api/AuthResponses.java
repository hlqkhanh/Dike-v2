package com.dike.identity.api;

import java.time.Instant;
import java.util.List;

public final class AuthResponses {

  private AuthResponses() {}

  public record AuthSessionResponse(boolean authenticated, UserView user, SessionView session) {}

  public record UserView(
      String id,
      String displayName,
      String avatarUrl,
      String email,
      String onboardingStatus,
      String phoneStatus,
      String phoneMasked,
      String nextAction) {}

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
