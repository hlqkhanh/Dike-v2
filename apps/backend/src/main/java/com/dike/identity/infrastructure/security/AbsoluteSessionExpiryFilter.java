package com.dike.identity.infrastructure.security;

import com.dike.identity.application.AuthTelemetry;
import com.dike.identity.application.DikePrincipal;
import com.dike.identity.application.IdentityProvisioningService;
import com.dike.identity.domain.AccountStatus;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.time.Clock;
import java.time.Instant;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

final class AbsoluteSessionExpiryFilter extends OncePerRequestFilter {

  private final Clock clock;
  private final IdentityProperties properties;
  private final IdentityProvisioningService identities;
  private final AuthTelemetry telemetry;

  AbsoluteSessionExpiryFilter(
      Clock clock,
      IdentityProperties properties,
      IdentityProvisioningService identities,
      AuthTelemetry telemetry) {
    this.clock = clock;
    this.properties = properties;
    this.identities = identities;
    this.telemetry = telemetry;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {
    HttpSession session = request.getSession(false);
    if (session != null) {
      Instant now = clock.instant();
      Instant absolute = (Instant) session.getAttribute(SessionAttributes.ABSOLUTE_EXPIRES_AT);
      if (absolute != null && !absolute.isAfter(now)) {
        session.invalidate();
        telemetry.session("absolute_expired");
        SecurityErrorWriter.write(
            request,
            response,
            HttpServletResponse.SC_UNAUTHORIZED,
            "AUTH_SESSION_EXPIRED",
            "Phiên đăng nhập đã hết hạn");
        return;
      }
      var authentication = SecurityContextHolder.getContext().getAuthentication();
      if (authentication != null
          && authentication.getPrincipal() instanceof DikePrincipal principal
          && identities.requireUser(principal.userId()).accountStatus() == AccountStatus.LOCKED) {
        session.invalidate();
        SecurityContextHolder.clearContext();
        telemetry.session("account_locked");
        SecurityErrorWriter.write(
            request,
            response,
            HttpServletResponse.SC_UNAUTHORIZED,
            "AUTH_SESSION_REVOKED",
            "Tài khoản không còn quyền sử dụng phiên này");
        return;
      }
      Instant lastSeen = (Instant) session.getAttribute(SessionAttributes.LAST_SEEN_AT);
      if (lastSeen != null
          && lastSeen.plus(properties.session().lastSeenWriteInterval()).isBefore(now)) {
        session.setAttribute(SessionAttributes.LAST_SEEN_AT, now);
      }
    }
    filterChain.doFilter(request, response);
  }
}
