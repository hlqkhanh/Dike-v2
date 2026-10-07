package com.dike.identity;

import com.dike.identity.application.AccountAccessService;
import com.dike.identity.application.AccountAuthority;
import org.springframework.stereotype.Service;

/** Public identity-module facade for authorization decisions in other modules. */
@Service
public class IdentityAccess {

  private final AccountAccessService accounts;

  public IdentityAccess(AccountAccessService accounts) {
    this.accounts = accounts;
  }

  public Access require(String userId) {
    var account = accounts.require(userId);
    return new Access(
        account.accountId(),
        account.authorities().contains(AccountAuthority.MEMBER),
        account.authorities().contains(AccountAuthority.VERIFIED_MEMBER),
        account.authorities().contains(AccountAuthority.APPROVED_DRIVER),
        DriverEvidence.valueOf(account.driverApprovalEvidence().name()),
        account.authorizationVersion());
  }

  public record Access(
      String accountId,
      boolean member,
      boolean verifiedMember,
      boolean approvedDriver,
      DriverEvidence driverEvidence,
      long authorizationVersion) {}

  public enum DriverEvidence {
    NONE,
    REAL,
    SIMULATED
  }
}
