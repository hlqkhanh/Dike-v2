package com.dike.community;

import com.dike.community.application.SocialStore;
import org.springframework.stereotype.Service;

/** Called only after identity's account-deletion retention window has elapsed. */
@Service
public class SocialAccountDeletion {
  private final SocialStore store;

  public SocialAccountDeletion(SocialStore store) {
    this.store = store;
  }

  public void purge(String userId) {
    store.transaction(
        () -> {
          store.purgeUser(userId);
          return null;
        });
  }
}
