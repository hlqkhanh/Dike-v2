package com.dike.identity.application;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.dike.community.SocialAccessPolicy;
import java.time.Clock;
import org.junit.jupiter.api.Test;

class ProfileSocialPolicyTest {
  @Test
  void blockStopsDirectProfileBeforeReadingPrivateDataEvenForAdmin() {
    var policy = mock(SocialAccessPolicy.class);
    var identities = mock(IdentityStore.class);
    var data = mock(ProfileDataStore.class);
    var service =
        new ProfileService(
            data,
            identities,
            mock(AccountAccessService.class),
            Clock.systemUTC(),
            policy,
            mock(com.dike.community.SocialPrivacyChanges.class));
    when(policy.blocked("viewer", "owner")).thenReturn(true);
    assertThatThrownBy(() -> service.view("viewer", "owner"))
        .isInstanceOf(ProfileService.NotVisibleException.class);
    verifyNoInteractions(identities, data);
  }
}
