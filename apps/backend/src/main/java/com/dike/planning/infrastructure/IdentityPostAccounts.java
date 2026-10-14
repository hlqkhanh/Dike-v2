package com.dike.planning.infrastructure;

import com.dike.identity.IdentityAccess;
import com.dike.planning.PostAccounts;
import org.springframework.stereotype.Component;

@Component
class IdentityPostAccounts implements PostAccounts {
  private final IdentityAccess accounts;
  private final com.dike.identity.IdentityCommandGuard guard;

  IdentityPostAccounts(IdentityAccess accounts, com.dike.identity.IdentityCommandGuard guard) {
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

  public String displayName(String id) {
    return accounts.displayName(id);
  }

  public String avatarUrl(String id) {
    return accounts.avatarUrl(id);
  }

  public void fence(String id) {
    guard.fence(id);
  }
}
