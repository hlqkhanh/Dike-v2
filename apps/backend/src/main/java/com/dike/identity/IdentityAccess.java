package com.dike.identity;

import com.dike.identity.application.AccountAccessService;
import com.dike.identity.application.AccountAuthority;
import com.dike.identity.application.ProfileDataStore;
import com.dike.identity.domain.AccountStatus;
import org.springframework.stereotype.Service;

/** Public identity-module facade for authorization decisions in other modules. */
@Service
public class IdentityAccess {

  private final AccountAccessService accounts;
  private final ProfileDataStore profiles;

  public IdentityAccess(AccountAccessService accounts, ProfileDataStore profiles) {
    this.accounts = accounts;
    this.profiles = profiles;
  }

  public boolean allowsMessageRequests(String userId) {
    return profiles.findPrivacy(userId).map(v -> v.allowMessageRequests()).orElse(true);
  }

  public Access require(String userId) {
    var account = accounts.require(userId);
    return new Access(
        account.accountId(),
        account.authorities().contains(AccountAuthority.MEMBER),
        account.authorities().contains(AccountAuthority.VERIFIED_MEMBER),
        account.authorities().contains(AccountAuthority.APPROVED_DRIVER),
        account.authorities().contains(AccountAuthority.MODERATOR),
        account.authorities().contains(AccountAuthority.ADMIN),
        account.accountStatus() == AccountStatus.LOCKED,
        DriverEvidence.valueOf(account.driverApprovalEvidence().name()),
        account.authorizationVersion());
  }

  public record Access(
      String accountId,
      boolean member,
      boolean verifiedMember,
      boolean approvedDriver,
      boolean moderator,
      boolean admin,
      boolean locked,
      DriverEvidence driverEvidence,
      long authorizationVersion) {

    public Access(
        String accountId,
        boolean member,
        boolean verifiedMember,
        boolean approvedDriver,
        DriverEvidence driverEvidence,
        long authorizationVersion) {
      this(
          accountId,
          member,
          verifiedMember,
          approvedDriver,
          false,
          false,
          false,
          driverEvidence,
          authorizationVersion);
    }
  }

  public enum DriverEvidence {
    NONE,
    REAL,
    SIMULATED
  }
}
