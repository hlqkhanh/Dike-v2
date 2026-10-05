package com.dike.identity.application;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.dike.identity.domain.Account;
import com.dike.shared.api.ApiException;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class AuthServiceTest {
  private final AccountStore accounts = mock(AccountStore.class);
  private final SessionStore sessions = mock(SessionStore.class);
  private final AuthService service = new AuthService(accounts, sessions);

  @Test
  void durableVersionRejectsSessionAfterLogoutAll() {
    when(sessions.read("credential"))
        .thenReturn(new SessionStore.Session("device", "user", 1, 0, 0, 100, "csrf"));
    when(accounts.require("user"))
        .thenReturn(
            new Account(
                "user",
                "Name",
                "test@example.invalid",
                null,
                "NONE",
                2,
                Instant.EPOCH,
                Instant.EPOCH));
    assertThrows(ApiException.class, () -> service.require("credential"));
  }

  @Test
  void refreshNeverRotatesWithoutCsrf() {
    var account =
        new Account(
            "user", "Name", "test@example.invalid", null, "NONE", 1, Instant.EPOCH, Instant.EPOCH);
    when(sessions.read("credential"))
        .thenReturn(new SessionStore.Session("device", "user", 1, 0, 0, 100, "csrf"));
    when(accounts.require("user")).thenReturn(account);
    assertThrows(ApiException.class, () -> service.refresh("credential", "wrong"));
    verify(sessions, never()).rotate(anyString(), anyString());
  }

  @Test
  void logoutAllCommitsVersionBeforeRedisCleanup() {
    var p =
        new AuthService.Principal(
            new Account(
                "user",
                "Name",
                "test@example.invalid",
                null,
                "NONE",
                1,
                Instant.EPOCH,
                Instant.EPOCH),
            new SessionStore.Session("device", "user", 1, 0, 0, 100, "csrf"));
    when(sessions.list("user")).thenThrow(new IllegalStateException("Redis unavailable"));
    assertThrows(IllegalStateException.class, () -> service.logoutAll(p));
    verify(accounts).revokeAll("user");
  }
}
