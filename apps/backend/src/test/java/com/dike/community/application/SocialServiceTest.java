package com.dike.community.application;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.dike.community.SocialAccounts;
import com.dike.community.domain.SocialRelation;
import com.dike.community.domain.SocialRelation.Action;
import com.dike.shared.api.ApiException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.function.Supplier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SocialServiceTest {
  private final SocialStore store = mock(SocialStore.class);
  private final SocialAccounts accounts = mock(SocialAccounts.class);
  private final Instant now = Instant.parse("2026-10-07T00:00:00Z");
  private final SocialService service =
      new SocialService(store, accounts, Clock.fixed(now, ZoneOffset.UTC));

  @BeforeEach
  void setup() {
    when(accounts.active(anyString())).thenReturn(true);
    when(accounts.visibleName(anyString(), anyString())).thenReturn(Optional.of("Member"));
    when(store.transaction(any())).thenAnswer(call -> ((Supplier<?>) call.getArgument(0)).get());
  }

  @Test
  void thirdPartyCannotActOnKnownInvitation() {
    var pending = SocialRelation.empty("a", "b", now).apply(Action.SEND, "a", "request-1", now);
    when(store.invitation("request-1")).thenReturn(Optional.of(pending));
    assertThatThrownBy(() -> service.command("c", Action.ACCEPT, null, "request-1", "valid-key-1"))
        .isInstanceOf(ApiException.class);
    verify(store, never()).save(any(), any(), anyString(), anyString());
  }

  @Test
  void blockedTargetCannotBeProbedAndOwnBlockDoesNotExposeOtherBlock() {
    var blocked = SocialRelation.empty("a", "b", now).apply(Action.BLOCK, "b", null, now);
    when(store.pair("a", "b")).thenReturn(Optional.of(blocked));
    assertThatThrownBy(() -> service.relation("a", "b")).isInstanceOf(ApiException.class);
    var result = service.command("a", Action.BLOCK, "b", null, "valid-key-1");
    assertThat(result.blockedByMe()).isTrue();
    assertThat(result.allowedActions()).containsExactly("UNBLOCK");
    assertThat(result.displayName()).isEqualTo("Người dùng");
    assertThat(result.requestId()).isNull();
  }

  @Test
  void lockedAccountCannotReadOrMutateAndInvalidListsFail() {
    when(accounts.active("a")).thenReturn(false);
    assertThatThrownBy(() -> service.list("a", "friends", null, 20))
        .isInstanceOf(ApiException.class);
    assertThatThrownBy(() -> service.command("a", Action.SEND, "b", null, "valid-key-1"))
        .isInstanceOf(ApiException.class);
    assertThatThrownBy(() -> service.list("b", "all", null, 20)).isInstanceOf(ApiException.class);
    verifyNoInteractions(store);
  }

  @Test
  void idempotentReplayDoesNotReturnDataAfterOppositeBlock() {
    var blocked = SocialRelation.empty("a", "b", now).apply(Action.BLOCK, "b", null, now);
    when(store.pair("a", "b")).thenReturn(Optional.of(blocked));
    when(store.receipt("a", "valid-key-1")).thenReturn(Optional.of("SEND:b"));
    assertThatThrownBy(() -> service.command("a", Action.SEND, "b", null, "valid-key-1"))
        .isInstanceOf(ApiException.class);
    verify(store, never()).save(any(), any(), anyString(), anyString());
  }
}
