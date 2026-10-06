package com.dike.identity.application;

import com.dike.community.SocialAccounts;
import com.dike.identity.domain.AccountStatus;
import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
class IdentitySocialAccounts implements SocialAccounts {
  private final IdentityStore identities;
  private final ProfileService profiles;

  IdentitySocialAccounts(IdentityStore identities, ProfileService profiles) {
    this.identities = identities;
    this.profiles = profiles;
  }

  @Override
  public boolean active(String userId) {
    return identities
        .findUserById(userId)
        .map(user -> user.accountStatus() == AccountStatus.ACTIVE)
        .orElse(false);
  }

  @Override
  public Optional<String> visibleName(String viewerId, String userId) {
    try {
      return Optional.of(profiles.view(viewerId, userId).displayName());
    } catch (ProfileService.NotVisibleException exception) {
      return Optional.empty();
    }
  }
}
