package com.dike.community;

import com.dike.community.application.SocialStore;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Pilot-wide invalidation also reaches viewers who have no friendship with a profile owner. */
@Service
public class SocialPrivacyChanges {
  private final SocialStore store;

  public SocialPrivacyChanges(SocialStore store) {
    this.store = store;
  }

  @Transactional
  public void invalidateProfiles() {
    store.invalidateProfiles();
  }
}
