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

  public String displayName(String userId) {
    return profiles
        .findProfile(userId)
        .map(profile -> profile.displayName())
        .filter(name -> !name.isBlank())
        .orElse("Thành viên Diké");
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
        AccessMode.valueOf(account.accessMode().name()),
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
      AccessMode accessMode,
      long authorizationVersion) {

    public Access {
      driverEvidence = driverEvidence == null ? DriverEvidence.NONE : driverEvidence;
      accessMode = accessMode == null ? AccessMode.RESTRICTED : accessMode;
    }

    public Access(
        String accountId,
        boolean member,
        boolean verifiedMember,
        boolean approvedDriver,
        boolean moderator,
        boolean admin,
        boolean locked,
        DriverEvidence driverEvidence,
        long authorizationVersion) {
      this(
          accountId,
          member,
          verifiedMember,
          approvedDriver,
          moderator,
          admin,
          locked,
          driverEvidence,
          accessModeFor(driverEvidence),
          authorizationVersion);
    }

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
          accessModeFor(driverEvidence),
          authorizationVersion);
    }

    private static AccessMode accessModeFor(DriverEvidence evidence) {
      if (evidence == null) return AccessMode.RESTRICTED;
      return switch (evidence) {
        case NONE -> AccessMode.RESTRICTED;
        case REAL -> AccessMode.REAL;
        case SIMULATED -> AccessMode.SIMULATED;
      };
    }
  }

  public enum DriverEvidence {
    NONE,
    REAL,
    SIMULATED
  }

  public enum AccessMode {
    RESTRICTED,
    REAL,
    SIMULATED
  }
}
