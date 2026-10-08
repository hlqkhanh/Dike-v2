package com.dike.identity.application;

import com.dike.identity.domain.AccountRole;
import com.dike.identity.domain.AccountStatus;
import com.dike.identity.domain.PhoneStatus;
import com.dike.identity.domain.UserAccount;
import com.dike.identity.domain.VerificationEvidence;
import java.util.EnumSet;
import java.util.Set;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

@Service
public class AccountAccessService {

  private final IdentityStore store;
  private final ConsentService consents;
  private final boolean simulatedEvidenceAllowed;
  private final boolean simulatedFullAccessEnabled;

  public AccountAccessService(
      IdentityStore store, ConsentService consents, Environment environment) {
    this.store = store;
    this.consents = consents;
    String current = environment.getProperty("dike.environment", "local");
    this.simulatedEvidenceAllowed = "local".equals(current) || "test".equals(current);
    boolean requested =
        environment.getProperty(
            "dike.identity.simulated-full-access-enabled", Boolean.class, false);
    if (!simulatedEvidenceAllowed && requested) {
      throw new IllegalStateException(
          "Simulated full access is restricted to local and test environments");
    }
    this.simulatedFullAccessEnabled = simulatedEvidenceAllowed && requested;
  }

  public AccountAccessSnapshot require(String userId) {
    UserAccount user =
        store
            .findUserById(userId)
            .orElseThrow(() -> new IllegalStateException("Authenticated user does not exist"));
    Set<AccountAuthority> authorities = EnumSet.noneOf(AccountAuthority.class);
    DriverApprovalEvidence driverApprovalEvidence = DriverApprovalEvidence.NONE;
    VerificationEvidence verificationEvidence = user.verificationEvidence();
    AccessMode accessMode = AccessMode.RESTRICTED;
    if (user.accountStatus() == AccountStatus.ACTIVE) {
      authorities.add(AccountAuthority.MEMBER);
      if (isAcceptedVerification(user)) {
        authorities.add(AccountAuthority.VERIFIED_MEMBER);
        accessMode = AccessMode.REAL;
        if (user.assignedRoles().contains(AccountRole.APPROVED_DRIVER)) {
          authorities.add(AccountAuthority.APPROVED_DRIVER);
          driverApprovalEvidence = DriverApprovalEvidence.REAL;
        }
      } else if (isEligibleForSimulatedFullAccess(user)) {
        authorities.add(AccountAuthority.VERIFIED_MEMBER);
        authorities.add(AccountAuthority.APPROVED_DRIVER);
        verificationEvidence = VerificationEvidence.SIMULATED;
        driverApprovalEvidence = DriverApprovalEvidence.SIMULATED;
        accessMode = AccessMode.SIMULATED;
      }
      if (user.assignedRoles().contains(AccountRole.MODERATOR)) {
        authorities.add(AccountAuthority.MODERATOR);
      }
      if (user.assignedRoles().contains(AccountRole.ADMIN)) {
        authorities.add(AccountAuthority.ADMIN);
      }
    }
    return new AccountAccessSnapshot(
        user.id(),
        user.accountStatus(),
        authorities,
        verificationEvidence,
        driverApprovalEvidence,
        accessMode,
        user.authorizationVersion());
  }

  private boolean isEligibleForSimulatedFullAccess(UserAccount user) {
    return simulatedFullAccessEnabled
        && user.onboardingStatus() == com.dike.identity.domain.OnboardingStatus.PHONE_SUBMITTED
        && user.phoneE164() != null
        && !user.phoneE164().isBlank()
        && consents.hasRequiredConsents(user.id());
  }

  private boolean isAcceptedVerification(UserAccount user) {
    if (user.phoneStatus() != PhoneStatus.VERIFIED) return false;
    return user.verificationEvidence() == VerificationEvidence.REAL;
  }
}
