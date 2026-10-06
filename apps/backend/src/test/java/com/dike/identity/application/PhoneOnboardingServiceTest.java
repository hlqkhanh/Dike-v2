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
import com.dike.identity.domain.VerificationEvidence;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Set;
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
            1,
            null,
            VerificationEvidence.NONE,
            Set.of(),
            1,
            NOW,
            NOW,
            1);
    UserAccount current =
        new UserAccount(
            "user-1",
            "user@example.com",
            "User",
            null,
            AccountStatus.ACTIVE,
            OnboardingStatus.PHONE_REQUIRED,
            null,
            PhoneStatus.NOT_PROVIDED,
            0,
            null,
            VerificationEvidence.NONE,
            Set.of(),
            0,
            NOW,
            NOW,
            0);
    when(store.findUserById("user-1")).thenReturn(java.util.Optional.of(current));
    when(store.updatePhoneCandidate("user-1", 0, "+84901234567", NOW)).thenReturn(updated);

    UserAccount result = service.submit("user-1", "0901 234 567", 0, null);

    assertThat(result.phoneStatus()).isEqualTo(PhoneStatus.UNVERIFIED);
    verify(store).updatePhoneCandidate("user-1", 0, "+84901234567", NOW);
  }

  @Test
  void submittingTheSameCanonicalPhoneDoesNotDowngradeVerifiedState() {
    UserAccount verified =
        new UserAccount(
            "user-1",
            "user@example.com",
            "User",
            null,
            AccountStatus.ACTIVE,
            OnboardingStatus.PHONE_SUBMITTED,
            "+84901234567",
            PhoneStatus.VERIFIED,
            3,
            NOW,
            VerificationEvidence.REAL,
            Set.of(),
            7,
            NOW,
            NOW,
            2);
    when(store.findUserById("user-1")).thenReturn(java.util.Optional.of(verified));

    UserAccount result = service.submit("user-1", "0901 234 567", 3, null);

    assertThat(result).isSameAs(verified);
    assertThat(result.phoneStatus()).isEqualTo(PhoneStatus.VERIFIED);
    verify(store, org.mockito.Mockito.never())
        .updatePhoneCandidate(
            org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.anyLong(),
            org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.any());
  }

  @Test
  void rejectsInvalidPhone() {
    assertThatThrownBy(() -> service.submit("user-1", "123", 0, null))
        .isInstanceOf(PhoneOnboardingService.InvalidPhoneException.class);
  }

  @Test
  void verifiedPhoneChangeRequiresRecentGoogleAuthentication() {
    UserAccount verified =
        new UserAccount(
            "user-1",
            "user@example.com",
            "User",
            null,
            AccountStatus.ACTIVE,
            OnboardingStatus.PHONE_SUBMITTED,
            "+84901234567",
            PhoneStatus.VERIFIED,
            3,
            NOW,
            VerificationEvidence.REAL,
            Set.of(),
            7,
            NOW,
            NOW,
            2);
    when(store.findUserById("user-1")).thenReturn(java.util.Optional.of(verified));

    assertThatThrownBy(() -> service.submit("user-1", "0912 345 678", 3, null))
        .isInstanceOf(PhoneOnboardingService.ReauthenticationRequiredException.class);
    assertThatThrownBy(() -> service.submit("user-1", "0912 345 678", 3, NOW.minusSeconds(301)))
        .isInstanceOf(PhoneOnboardingService.ReauthenticationRequiredException.class);
  }

  @Test
  void verifiedPhoneCanChangeAfterRecentGoogleAuthentication() {
    UserAccount verified =
        new UserAccount(
            "user-1",
            "user@example.com",
            "User",
            null,
            AccountStatus.ACTIVE,
            OnboardingStatus.PHONE_SUBMITTED,
            "+84901234567",
            PhoneStatus.VERIFIED,
            3,
            NOW,
            VerificationEvidence.REAL,
            Set.of(),
            7,
            NOW,
            NOW,
            2);
    UserAccount updated =
        new UserAccount(
            "user-1",
            "user@example.com",
            "User",
            null,
            AccountStatus.ACTIVE,
            OnboardingStatus.PHONE_SUBMITTED,
            "+84912345678",
            PhoneStatus.UNVERIFIED,
            4,
            null,
            VerificationEvidence.NONE,
            Set.of(),
            8,
            NOW,
            NOW,
            3);
    when(store.findUserById("user-1")).thenReturn(java.util.Optional.of(verified));
    when(store.updatePhoneCandidate("user-1", 3, "+84912345678", NOW)).thenReturn(updated);

    UserAccount result = service.submit("user-1", "0912 345 678", 3, NOW.minusSeconds(300));

    assertThat(result.phoneStatus()).isEqualTo(PhoneStatus.UNVERIFIED);
    verify(store).updatePhoneCandidate("user-1", 3, "+84912345678", NOW);
  }
}
