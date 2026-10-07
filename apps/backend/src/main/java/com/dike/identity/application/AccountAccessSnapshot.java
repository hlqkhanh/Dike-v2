package com.dike.identity.application;

import com.dike.identity.domain.AccountStatus;
import com.dike.identity.domain.VerificationEvidence;
import java.util.Set;

public record AccountAccessSnapshot(
    String accountId,
    AccountStatus accountStatus,
    Set<AccountAuthority> authorities,
    VerificationEvidence verificationEvidence,
    DriverApprovalEvidence driverApprovalEvidence,
    long authorizationVersion) {

  public AccountAccessSnapshot {
    authorities = Set.copyOf(authorities);
  }
}
