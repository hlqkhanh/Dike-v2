package com.dike.community;

import java.util.Optional;

/** Implemented by the identity module without exposing its entities. */
public interface SocialAccounts {
  boolean active(String userId);

  Optional<String> visibleName(String viewerId, String userId);
}
