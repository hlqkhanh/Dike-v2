package com.dike.identity.application;

import com.dike.identity.domain.Account;
import com.dike.identity.domain.PhoneNumber;
import com.dike.shared.api.ApiException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class AuthService {
  private final AccountStore accounts;
  private final SessionStore sessions;

  public AuthService(AccountStore accounts, SessionStore sessions) {
    this.accounts = accounts;
    this.sessions = sessions;
  }

  public record Principal(Account user, SessionStore.Session session) {}

  public Principal require(String credential) {
    var session = sessions.read(credential);
    var account = accounts.require(session.userId());
    if (account.sessionVersion() != session.version())
      throw new ApiException(HttpStatus.UNAUTHORIZED, "SESSION_REVOKED", "Please sign in again");
    return new Principal(account, session);
  }

  public void csrf(Principal principal, String token) {
    if (token == null
        || !MessageDigest.isEqual(
            principal.session().csrf().getBytes(StandardCharsets.UTF_8),
            token.getBytes(StandardCharsets.UTF_8)))
      throw new ApiException(HttpStatus.FORBIDDEN, "CSRF_INVALID", "Request verification failed");
  }

  public SessionStore.Issued login(String subject, String name, String email) {
    Account account = accounts.login(subject, name, email);
    return sessions.create(account.id(), account.sessionVersion());
  }

  public SessionStore.Issued refresh(String credential, String token) {
    Principal principal = require(credential);
    csrf(principal, token);
    sessions.rateLimit("refresh:" + principal.user().id(), 10);
    return sessions.rotate(credential, token);
  }

  public Account phone(Principal principal, String phone) {
    try {
      return accounts.phone(principal.user().id(), PhoneNumber.normalize(phone));
    } catch (IllegalArgumentException ex) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "PHONE_INVALID", "Enter a valid Vietnamese mobile number");
    }
  }

  public List<SessionStore.Session> list(Principal principal) {
    return sessions.list(principal.user().id()).stream()
        .filter(s -> s.version() == principal.user().sessionVersion())
        .toList();
  }

  public void revoke(Principal principal, String deviceId) {
    sessions.revoke(principal.user().id(), deviceId);
  }

  public void logoutAll(Principal principal) {
    accounts.revokeAll(principal.user().id());
    // Version invalidation is the durable fence; deleting stale Redis entries is cleanup only.
    for (var s : sessions.list(principal.user().id())) {
      if (s.version() <= principal.user().sessionVersion()) {
        try {
          sessions.revoke(principal.user().id(), s.deviceId());
        } catch (ApiException ignored) {
          /* Concurrent revoke already removed the session. */
        }
      }
    }
  }

  public void rateLimit(String ip) {
    sessions.rateLimit("oauth:" + ip, 20);
  }
}
