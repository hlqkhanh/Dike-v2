package com.dike.community;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.dike.community.application.SocialStore;
import com.dike.community.domain.SocialRelation;
import com.dike.community.domain.SocialRelation.Action;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class SocialAccessPolicyTest {
  @Test
  void eachReadRechecksRelationshipAndCommunityMembershipIsIndependent() {
    SocialStore store = mock(SocialStore.class);
    var policy = new SocialAccessPolicy(store);
    var pending =
        SocialRelation.empty("a", "b", Instant.EPOCH).apply(Action.SEND, "a", "one", Instant.EPOCH);
    var accepted = pending.apply(Action.ACCEPT, "b", "one", Instant.EPOCH);
    when(store.pair("a", "b")).thenReturn(Optional.of(pending));
    assertThat(policy.canRead("a", "b", SocialAccessPolicy.Visibility.FRIENDS, true)).isFalse();
    when(store.pair("a", "b")).thenReturn(Optional.of(accepted));
    assertThat(policy.canRead("a", "b", SocialAccessPolicy.Visibility.FRIENDS, false)).isTrue();
    assertThat(policy.canRead("a", "b", SocialAccessPolicy.Visibility.COMMUNITY, false)).isFalse();
    assertThat(policy.canRead("a", "b", SocialAccessPolicy.Visibility.PRIVATE, true)).isFalse();
    when(store.pair("a", "b"))
        .thenReturn(Optional.of(accepted.apply(Action.BLOCK, "b", null, Instant.EPOCH)));
    for (var visibility : SocialAccessPolicy.Visibility.values())
      assertThat(policy.canRead("a", "b", visibility, true)).isFalse();
    assertThat(policy.canRead(null, "b", SocialAccessPolicy.Visibility.PUBLIC, true)).isFalse();
    assertThat(policy.canRead("a", "a", SocialAccessPolicy.Visibility.PRIVATE, false)).isTrue();
  }
}
