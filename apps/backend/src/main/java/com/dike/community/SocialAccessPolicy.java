package com.dike.community;

import com.dike.community.application.SocialStore;
import org.springframework.stereotype.Service;

/** Resource owners must combine this policy with their own authoritative resource checks. */
@Service
public class SocialAccessPolicy {
  private final SocialStore store;

  public SocialAccessPolicy(SocialStore store) {
    this.store = store;
  }

  public boolean blocked(String viewer, String owner) {
    if (viewer == null || owner == null) return true;
    if (viewer.equals(owner)) return false;
    return store.pair(viewer, owner).map(r -> !r.blockedBy().isEmpty()).orElse(false);
  }

  public boolean friends(String viewer, String owner) {
    if (viewer == null || owner == null || viewer.equals(owner)) return false;
    return store.pair(viewer, owner).map(r -> r.friends()).orElse(false);
  }

  public enum Visibility {
    PRIVATE,
    FRIENDS,
    COMMUNITY,
    PUBLIC
  }

  /** membership must be established by the module owning the resource, never request input. */
  public boolean canRead(String viewer, String owner, Visibility visibility, boolean membership) {
    if (viewer == null || owner == null || visibility == null) return false;
    if (viewer.equals(owner)) return true;
    var relation = store.pair(viewer, owner);
    if (relation.map(r -> !r.blockedBy().isEmpty()).orElse(false)) return false;
    return switch (visibility) {
      case PRIVATE -> false;
      case PUBLIC -> true;
      case COMMUNITY -> membership;
      case FRIENDS -> relation.map(r -> r.friends()).orElse(false);
    };
  }
}
