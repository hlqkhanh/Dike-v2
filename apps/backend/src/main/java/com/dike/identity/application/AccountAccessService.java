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
  private final boolean simulatedEvidenceAllowed;

  public AccountAccessService(IdentityStore store, Environment environment) {
    this.store = store;
    String current = environment.getProperty("dike.environment", "local");
    this.simulatedEvidenceAllowed = "local".equals(current) || "test".equals(current);
  }

  public AccountAccessSnapshot require(String userId) {
    UserAccount user =
        store
            .findUserById(userId)
            .orElseThrow(() -> new IllegalStateException("Authenticated user does not exist"));
    Set<AccountAuthority> authorities = EnumSet.noneOf(AccountAuthority.class);
    if (user.accountStatus() == AccountStatus.ACTIVE) {
      authorities.add(AccountAuthority.MEMBER);
      if (isAcceptedVerification(user)) {
        authorities.add(AccountAuthority.VERIFIED_MEMBER);
        if (user.assignedRoles().contains(AccountRole.APPROVED_DRIVER)) {
          authorities.add(AccountAuthority.APPROVED_DRIVER);
        }
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
        user.verificationEvidence(),
        user.authorizationVersion());
  }

  private boolean isAcceptedVerification(UserAccount user) {
    if (user.phoneStatus() != PhoneStatus.VERIFIED) return false;
    return user.verificationEvidence() == VerificationEvidence.REAL
        || (simulatedEvidenceAllowed
            && user.verificationEvidence() == VerificationEvidence.SIMULATED);
  }
}
