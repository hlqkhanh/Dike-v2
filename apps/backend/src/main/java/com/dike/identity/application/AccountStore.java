package com.dike.identity.application;

import com.dike.identity.domain.Account;

public interface AccountStore {
  Account login(String subject, String name, String email);

  Account require(String id);

  Account phone(String id, String phone);

  void revokeAll(String id);
}
