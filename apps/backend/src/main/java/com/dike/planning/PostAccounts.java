package com.dike.planning;

public interface PostAccounts {
  boolean active(String userId);

  boolean verified(String userId);

  void fence(String userId);
}
