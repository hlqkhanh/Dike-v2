package com.dike.identity.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.dike.identity.domain.AccountStatus;
import com.dike.identity.domain.OnboardingStatus;
import com.dike.identity.domain.PhoneStatus;
import com.dike.identity.domain.UserAccount;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class PhoneOnboardingServiceTest {

  private static final Instant NOW = Instant.parse("2026-10-06T00:00:00Z");
  private final IdentityStore store = mock(IdentityStore.class);
  private final PhoneOnboardingService service =
      new PhoneOnboardingService(store, Clock.fixed(NOW, ZoneOffset.UTC));

  @Test
  void normalizesVietnamesePhoneToE164WithoutVerifyingIt() {
    UserAccount updated =
        new UserAccount(
            "user-1",
            "user@example.com",
            "User",
            null,
            AccountStatus.ACTIVE,
            OnboardingStatus.PHONE_SUBMITTED,
            "+84901234567",
            PhoneStatus.UNVERIFIED,
            NOW,
            NOW,
            1);
    when(store.updatePhoneCandidate("user-1", "+84901234567", NOW)).thenReturn(updated);

    UserAccount result = service.submit("user-1", "0901 234 567");

    assertThat(result.phoneStatus()).isEqualTo(PhoneStatus.UNVERIFIED);
    verify(store).updatePhoneCandidate("user-1", "+84901234567", NOW);
  }

  @Test
  void rejectsInvalidPhone() {
    assertThatThrownBy(() -> service.submit("user-1", "123"))
        .isInstanceOf(PhoneOnboardingService.InvalidPhoneException.class);
  }
}
