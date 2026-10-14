package com.dike.planning;

public interface PostAccounts {
  boolean active(String userId);

  boolean verified(String userId);

  String displayName(String userId);

  String avatarUrl(String userId);

  void fence(String userId);
}
