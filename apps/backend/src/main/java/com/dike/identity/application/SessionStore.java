package com.dike.identity.application;

import java.util.List;

public interface SessionStore {
  record Session(
      String deviceId,
      String userId,
      long version,
      long issuedAt,
      long lastSeenAt,
      long expiresAt,
      String csrf) {}

  record Issued(String credential, Session session) {}

  Issued create(String userId, long version);

  Session read(String credential);

  Issued rotate(String credential, String csrf);

  void revoke(String userId, String deviceId);

  List<Session> list(String userId);

  void rateLimit(String key, int maximum);
}
