package com.dike.community.domain;

import static com.dike.community.domain.SocialRelation.Action.*;
import static org.assertj.core.api.Assertions.*;

import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class SocialRelationTest {
  private final Instant now = Instant.parse("2026-10-07T00:00:00Z");

  private SocialRelation pending() {
    return SocialRelation.empty("a", "b", now).apply(SEND, "a", "request-1", now);
  }

  @Test
  void canonicalPairDoesNotCollideAndReverseInviteDoesNotAccept() {
    assertThat(SocialRelation.empty("a", "bc", now).id())
        .isNotEqualTo(SocialRelation.empty("ab", "c", now).id());
    assertThat(SocialRelation.empty("a", "b", now).id())
        .isEqualTo(SocialRelation.empty("b", "a", now).id());
    var pending = pending();
    assertThat(pending.apply(SEND, "b", "request-2", now)).isSameAs(pending);
    assertThat(pending.friends()).isFalse();
  }

  @Test
  void onlyRecipientAcceptsAndOnlySenderCancelsCurrentInvitation() {
    assertThatThrownBy(() -> pending().apply(ACCEPT, "a", "request-1", now))
        .hasMessage("RESOURCE_NOT_AVAILABLE");
    assertThatThrownBy(() -> pending().apply(CANCEL, "b", "request-1", now))
        .hasMessage("RESOURCE_NOT_AVAILABLE");
    assertThatThrownBy(() -> pending().apply(ACCEPT, "c", "request-1", now))
        .hasMessage("RESOURCE_NOT_AVAILABLE");
    assertThatThrownBy(() -> pending().apply(ACCEPT, "b", "old", now))
        .hasMessage("SOCIAL_STATE_CONFLICT");
    assertThat(pending().apply(ACCEPT, "b", "request-1", now).friends()).isTrue();
  }

  @Test
  void rejectionCooldownIsBilateralAndEndsAtExactly168Hours() {
    var declined = pending().apply(DECLINE, "b", "request-1", now);
    for (String actor : java.util.List.of("a", "b")) {
      assertThatThrownBy(
              () -> declined.apply(SEND, actor, "new", now.plus(Duration.ofDays(7)).minusMillis(1)))
          .hasMessage("FRIENDSHIP_COOLDOWN");
      assertThat(declined.apply(SEND, actor, "new", now.plus(Duration.ofDays(7))).status())
          .isEqualTo(SocialRelation.Status.PENDING);
    }
  }

  @Test
  void withdrawalHasNoCooldownAndOldRequestCannotAffectResend() {
    var next = pending().apply(CANCEL, "a", "request-1", now).apply(SEND, "a", "new", now);
    assertThatThrownBy(() -> next.apply(ACCEPT, "b", "request-1", now))
        .hasMessage("SOCIAL_STATE_CONFLICT");
    assertThat(next.apply(ACCEPT, "b", "new", now).friends()).isTrue();
  }

  @Test
  void blockWinsInEitherOrderAndUnblockNeverRestoresFriendship() {
    var blockedFirst = pending().apply(BLOCK, "a", null, now);
    assertThatThrownBy(() -> blockedFirst.apply(ACCEPT, "b", "request-1", now))
        .hasMessage("RESOURCE_NOT_AVAILABLE");
    var acceptedFirst = pending().apply(ACCEPT, "b", "request-1", now).apply(BLOCK, "a", null, now);
    assertThat(acceptedFirst.friends()).isFalse();
    var mutual = acceptedFirst.apply(BLOCK, "b", null, now).apply(UNBLOCK, "a", null, now);
    assertThat(mutual.blockedBy()).containsExactly("b");
    assertThat(mutual.apply(UNBLOCK, "b", null, now).status())
        .isEqualTo(SocialRelation.Status.REMOVED);
    assertThat(mutual.cooldownUntil()).isEqualTo(now.plus(Duration.ofDays(7)));
  }

  @Test
  void repeatedRevokeDoesNotRestartCooldown() {
    var removed = pending().apply(ACCEPT, "b", "request-1", now).apply(REMOVE, "a", null, now);
    assertThat(removed.apply(REMOVE, "b", null, now.plusSeconds(60))).isSameAs(removed);
    assertThatThrownBy(() -> SocialRelation.empty("a", "a", now))
        .hasMessage("SOCIAL_INVALID_TARGET");
  }
}
