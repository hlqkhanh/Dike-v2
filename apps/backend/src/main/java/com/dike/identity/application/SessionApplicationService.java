package com.dike.identity.application;

import com.dike.identity.api.AuthResponses.AuthSessionResponse;
import com.dike.identity.api.AuthResponses.SessionListResponse;
import com.dike.identity.api.AuthResponses.SessionView;
import com.dike.identity.api.AuthResponses.UserView;
import com.dike.identity.domain.UserAccount;
import com.dike.identity.infrastructure.security.IdentityProperties;
import com.dike.identity.infrastructure.security.SessionAttributes;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.Session;
import org.springframework.stereotype.Service;

@Service
public class SessionApplicationService {

  private final FindByIndexNameSessionRepository<? extends Session> sessions;
  private final IdentityProvisioningService identities;
  private final AccountAccessService access;
  private final IdentityProperties properties;
  private final ConsentService consents;

  public SessionApplicationService(
      FindByIndexNameSessionRepository<? extends Session> sessions,
      IdentityProvisioningService identities,
      AccountAccessService access,
      IdentityProperties properties,
      ConsentService consents) {
    this.sessions = sessions;
    this.identities = identities;
    this.access = access;
    this.properties = properties;
    this.consents = consents;
  }

  public AuthSessionResponse current(DikePrincipal principal, HttpSession session) {
    UserAccount user = identities.requireUser(principal.userId());
    return new AuthSessionResponse(true, userView(user), sessionView(session, true));
  }

  public SessionListResponse list(DikePrincipal principal, String currentSessionId) {
    List<SessionView> result = new ArrayList<>();
    for (Session session : sessionsFor(principal.userId()).values()) {
      result.add(sessionView(session, session.getId().equals(currentSessionId)));
    }
    result.sort(Comparator.comparing(SessionView::lastSeenAt).reversed());
    return new SessionListResponse(List.copyOf(result));
  }

  public boolean revoke(DikePrincipal principal, String handle, HttpServletRequest request) {
    for (Session session : sessionsFor(principal.userId()).values()) {
      if (handle.equals(session.getAttribute(SessionAttributes.HANDLE))) {
        boolean current = session.getId().equals(request.getSession(false).getId());
        if (current) {
          request.getSession(false).invalidate();
        } else {
          delete(session.getId());
        }
        return true;
      }
    }
    return false;
  }

  public void logoutAll(DikePrincipal principal, HttpServletRequest request) {
    String current = request.getSession(false).getId();
    for (Session session : sessionsFor(principal.userId()).values()) {
      if (!session.getId().equals(current)) {
        delete(session.getId());
      }
    }
    request.getSession(false).invalidate();
  }

  @SuppressWarnings({"rawtypes", "unchecked"})
  private Map<String, Session> sessionsFor(String principal) {
    return (Map) sessions.findByPrincipalName(principal);
  }

  @SuppressWarnings({"rawtypes", "unchecked"})
  private void delete(String sessionId) {
    ((org.springframework.session.SessionRepository) sessions).deleteById(sessionId);
  }

  private UserView userView(UserAccount user) {
    AccountAccessSnapshot snapshot = access.require(user.id());
    String nextAction;
    if (!consents.hasRequiredConsents(user.id())) {
      nextAction = "REVIEW_CONSENT";
    } else {
      nextAction =
          switch (user.onboardingStatus()) {
            case PHONE_REQUIRED -> "SUBMIT_PHONE";
            case PHONE_SUBMITTED -> properties.requirePhoneOtp() ? "VERIFY_PHONE" : "NONE";
          };
    }
    return new UserView(
        user.id(),
        user.displayName(),
        user.avatarUrl(),
        user.canonicalEmail(),
        user.onboardingStatus().name(),
        user.phoneStatus().name(),
        mask(user.phoneE164()),
        user.phoneVersion(),
        user.verificationEvidence().name(),
        snapshot.authorities().stream().map(Enum::name).sorted().toList(),
        snapshot.authorizationVersion(),
        nextAction);
  }

  private SessionView sessionView(HttpSession session, boolean current) {
    Instant lastSeen = attribute(session, SessionAttributes.LAST_SEEN_AT, Instant.class);
    return new SessionView(
        attribute(session, SessionAttributes.HANDLE, String.class),
        attribute(session, SessionAttributes.DEVICE_LABEL, String.class),
        attribute(session, SessionAttributes.CREATED_AT, Instant.class),
        lastSeen,
        lastSeen.plus(properties.session().idleTimeout()),
        attribute(session, SessionAttributes.ABSOLUTE_EXPIRES_AT, Instant.class),
        current);
  }

  private SessionView sessionView(Session session, boolean current) {
    Instant lastSeen = attribute(session, SessionAttributes.LAST_SEEN_AT, Instant.class);
    return new SessionView(
        attribute(session, SessionAttributes.HANDLE, String.class),
        attribute(session, SessionAttributes.DEVICE_LABEL, String.class),
        attribute(session, SessionAttributes.CREATED_AT, Instant.class),
        lastSeen,
        lastSeen.plus(properties.session().idleTimeout()),
        attribute(session, SessionAttributes.ABSOLUTE_EXPIRES_AT, Instant.class),
        current);
  }

  private <T> T attribute(HttpSession session, String name, Class<T> type) {
    return type.cast(session.getAttribute(name));
  }

  private <T> T attribute(Session session, String name, Class<T> type) {
    return type.cast(session.getAttribute(name));
  }

  private String mask(String phone) {
    if (phone == null || phone.length() < 6) {
      return null;
    }
    return phone.substring(0, 4) + "••••" + phone.substring(phone.length() - 3);
  }
}
