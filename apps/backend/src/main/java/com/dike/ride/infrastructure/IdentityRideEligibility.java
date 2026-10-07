package com.dike.ride.infrastructure;

import com.dike.identity.IdentityAccess;
import com.dike.identity.IdentityCommandGuard;
import com.dike.ride.RideEligibility;
import org.springframework.stereotype.Component;

@Component
class IdentityRideEligibility implements RideEligibility {
  private final IdentityAccess accounts;
  private final IdentityCommandGuard guard;

  IdentityRideEligibility(IdentityAccess accounts, IdentityCommandGuard guard) {
    this.accounts = accounts;
    this.guard = guard;
  }

  public boolean active(String id) {
    try {
      return accounts.require(id).member();
    } catch (IllegalStateException missing) {
      return false;
    }
  }

  public boolean verified(String id) {
    return active(id) && accounts.require(id).verifiedMember();
  }

  public boolean driver(String id) {
    return active(id) && accounts.require(id).approvedDriver();
  }

  public void fence(String id) {
    guard.fence(id);
  }
}
