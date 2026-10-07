package com.dike.identity.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.dike.identity.domain.AccountRole;
import com.dike.identity.domain.AccountStatus;
import com.dike.identity.domain.OnboardingStatus;
import com.dike.identity.domain.PhoneStatus;
import com.dike.identity.domain.UserAccount;
import com.dike.identity.domain.VerificationEvidence;
import java.time.Instant;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class AccountAccessServiceTest {

  private final IdentityStore store = mock(IdentityStore.class);

  @Test
  void derivesVerifiedAndDriverOnlyWhenVerificationEvidenceIsAccepted() {
    when(store.findUserById("user-1"))
        .thenReturn(
            Optional.of(
                user(
                    AccountStatus.ACTIVE,
                    PhoneStatus.VERIFIED,
                    VerificationEvidence.REAL,
                    Set.of(AccountRole.APPROVED_DRIVER))));

    var snapshot = new AccountAccessService(store, environment("production")).require("user-1");

    assertThat(snapshot.authorities())
        .containsExactlyInAnyOrder(
            AccountAuthority.MEMBER,
            AccountAuthority.VERIFIED_MEMBER,
            AccountAuthority.APPROVED_DRIVER);
  }

  @Test
  void doesNotAcceptSimulatedEvidenceInHostedEnvironment() {
    when(store.findUserById("user-1"))
        .thenReturn(
            Optional.of(
                user(
                    AccountStatus.ACTIVE,
                    PhoneStatus.VERIFIED,
                    VerificationEvidence.SIMULATED,
                    Set.of(AccountRole.APPROVED_DRIVER))));

    var snapshot = new AccountAccessService(store, environment("staging")).require("user-1");

    assertThat(snapshot.authorities()).containsExactly(AccountAuthority.MEMBER);
    assertThat(snapshot.driverApprovalEvidence()).isEqualTo(DriverApprovalEvidence.NONE);
  }

  @Test
  void derivesSimulatedDriverApprovalForEveryVerifiedLocalUser() {
    when(store.findUserById("user-1"))
        .thenReturn(
            Optional.of(
                user(
                    AccountStatus.ACTIVE,
                    PhoneStatus.VERIFIED,
                    VerificationEvidence.SIMULATED,
                    Set.of())));

    var snapshot = new AccountAccessService(store, environment("local")).require("user-1");

    assertThat(snapshot.authorities())
        .containsExactlyInAnyOrder(
            AccountAuthority.MEMBER,
            AccountAuthority.VERIFIED_MEMBER,
            AccountAuthority.APPROVED_DRIVER);
    assertThat(snapshot.driverApprovalEvidence()).isEqualTo(DriverApprovalEvidence.SIMULATED);
  }

  @Test
  void canDisableSimulatedDriverApprovalLocally() {
    when(store.findUserById("user-1"))
        .thenReturn(
            Optional.of(
                user(
                    AccountStatus.ACTIVE,
                    PhoneStatus.VERIFIED,
                    VerificationEvidence.SIMULATED,
                    Set.of())));

    MockEnvironment environment =
        environment("local")
            .withProperty("dike.identity.simulated-driver-approval-enabled", "false");
    var snapshot = new AccountAccessService(store, environment).require("user-1");

    assertThat(snapshot.authorities())
        .containsExactlyInAnyOrder(AccountAuthority.MEMBER, AccountAuthority.VERIFIED_MEMBER);
    assertThat(snapshot.driverApprovalEvidence()).isEqualTo(DriverApprovalEvidence.NONE);
  }

  @Test
  void lockedAccountHasNoEffectiveAuthority() {
    when(store.findUserById("user-1"))
        .thenReturn(
            Optional.of(
                user(
                    AccountStatus.LOCKED,
                    PhoneStatus.VERIFIED,
                    VerificationEvidence.REAL,
                    Set.of(AccountRole.ADMIN))));

    var snapshot = new AccountAccessService(store, environment("production")).require("user-1");

    assertThat(snapshot.authorities()).isEmpty();
  }

  private MockEnvironment environment(String value) {
    return new MockEnvironment().withProperty("dike.environment", value);
  }

  private UserAccount user(
      AccountStatus status,
      PhoneStatus phoneStatus,
      VerificationEvidence evidence,
      Set<AccountRole> roles) {
    Instant now = Instant.parse("2026-10-06T00:00:00Z");
    return new UserAccount(
        "user-1",
        "user@example.com",
        "User",
        null,
        status,
        OnboardingStatus.PHONE_SUBMITTED,
        "+84901234567",
        phoneStatus,
        1,
        now,
        evidence,
        roles,
        4,
        now,
        now,
        1);
  }
}
