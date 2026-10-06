package com.dike.identity.infrastructure.security;

import com.dike.identity.application.AccountLinkRequiredException;
import com.dike.identity.application.AuthTelemetry;
import com.dike.identity.application.DikePrincipal;
import com.dike.identity.application.GoogleIdentityClaims;
import com.dike.identity.application.IdentityProvisioningService;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.time.Clock;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizedClientRepository;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.Session;

final class OidcLoginSuccessHandler implements AuthenticationSuccessHandler {

  private final IdentityProvisioningService provisioning;
  private final IdentityProperties properties;
  private final SecurityContextRepository securityContexts;
  private final OAuth2AuthorizedClientRepository authorizedClients;
  private final Clock clock;
  private final FindByIndexNameSessionRepository<? extends Session> sessions;
  private final AuthTelemetry telemetry;

  OidcLoginSuccessHandler(
      IdentityProvisioningService provisioning,
      IdentityProperties properties,
      SecurityContextRepository securityContexts,
      OAuth2AuthorizedClientRepository authorizedClients,
      Clock clock,
      FindByIndexNameSessionRepository<? extends Session> sessions,
      AuthTelemetry telemetry) {
    this.provisioning = provisioning;
    this.properties = properties;
    this.securityContexts = securityContexts;
    this.authorizedClients = authorizedClients;
    this.clock = clock;
    this.sessions = sessions;
    this.telemetry = telemetry;
  }

  @Override
  public void onAuthenticationSuccess(
      HttpServletRequest request,
      HttpServletResponse response,
      org.springframework.security.core.Authentication authentication)
      throws IOException, ServletException {
    OAuth2AuthenticationToken oauth = (OAuth2AuthenticationToken) authentication;
    OidcUser oidc = (OidcUser) oauth.getPrincipal();
    final com.dike.identity.domain.UserAccount user;
    try {
      user =
          provisioning.provisionGoogle(
              new GoogleIdentityClaims(
                  oidc.getIssuer().toString(),
                  oidc.getSubject(),
                  oidc.getEmail(),
                  Boolean.TRUE.equals(oidc.getEmailVerified()),
                  oidc.getFullName() == null ? oidc.getEmail() : oidc.getFullName(),
                  oidc.getPicture()));
    } catch (AccountLinkRequiredException exception) {
      telemetry.login("account_link_required");
      authorizedClients.removeAuthorizedClient(
          oauth.getAuthorizedClientRegistrationId(), oauth, request, response);
      SecurityContextHolder.clearContext();
      HttpSession failedSession = request.getSession(false);
      if (failedSession != null) {
        failedSession.invalidate();
      }
      response.sendRedirect(
          properties.publicBaseUrl().resolve("/login?error=ACCOUNT_LINK_REQUIRED").toString());
      return;
    }

    evictOldestSessions(user.id());

    Instant now = clock.instant();
    HttpSession session = request.getSession(true);
    session.setMaxInactiveInterval((int) properties.session().idleTimeout().toSeconds());
    session.setAttribute(SessionAttributes.HANDLE, UUID.randomUUID().toString());
    session.setAttribute(SessionAttributes.CREATED_AT, now);
    session.setAttribute(SessionAttributes.LAST_SEEN_AT, now);
    session.setAttribute(
        SessionAttributes.ABSOLUTE_EXPIRES_AT, now.plus(properties.session().absoluteLifetime()));
    session.setAttribute(
        SessionAttributes.DEVICE_LABEL, deviceLabel(request.getHeader("User-Agent")));

    var dikeAuthentication =
        UsernamePasswordAuthenticationToken.authenticated(
            new DikePrincipal(user.id()), null, List.of());
    SecurityContext context = SecurityContextHolder.createEmptyContext();
    context.setAuthentication(dikeAuthentication);
    SecurityContextHolder.setContext(context);
    securityContexts.saveContext(context, request, response);
    authorizedClients.removeAuthorizedClient(
        oauth.getAuthorizedClientRegistrationId(), oauth, request, response);
    telemetry.login("success");

    response.sendRedirect(properties.publicBaseUrl().resolve("/auth/complete").toString());
  }

  private String deviceLabel(String userAgent) {
    if (userAgent == null || userAgent.isBlank()) {
      return "Trình duyệt không xác định";
    }
    String normalized = userAgent.replaceAll("[\\r\\n\\t]", " ").trim();
    return normalized.substring(0, Math.min(normalized.length(), 120));
  }

  @SuppressWarnings({"rawtypes", "unchecked"})
  private void evictOldestSessions(String userId) {
    Map<String, Session> existing = (Map) sessions.findByPrincipalName(userId);
    int toDelete = existing.size() - properties.session().maximumPerUser() + 1;
    if (toDelete <= 0) return;
    existing.values().stream()
        .sorted(Comparator.comparing(Session::getCreationTime))
        .limit(toDelete)
        .forEach(
            session ->
                ((org.springframework.session.SessionRepository) sessions)
                    .deleteById(session.getId()));
  }
}
