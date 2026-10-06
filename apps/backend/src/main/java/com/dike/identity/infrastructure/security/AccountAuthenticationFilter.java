package com.dike.identity.infrastructure.security;

import com.dike.identity.application.AccountAccessService;
import com.dike.identity.application.DikePrincipal;
import com.dike.identity.domain.AccountStatus;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

final class AccountAuthenticationFilter extends OncePerRequestFilter {

  private final AccountAccessService access;

  AccountAuthenticationFilter(AccountAccessService access) {
    this.access = access;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {
    HttpSession session = request.getSession(false);
    if (session != null) {
      String accountId = (String) session.getAttribute(SessionAttributes.ACCOUNT_ID);
      if (accountId != null) {
        var snapshot = access.require(accountId);
        if (snapshot.accountStatus() != AccountStatus.ACTIVE) {
          session.invalidate();
          SecurityErrorWriter.write(
              request,
              response,
              HttpServletResponse.SC_UNAUTHORIZED,
              "AUTH_SESSION_REVOKED",
              "Tài khoản không còn quyền sử dụng phiên này");
          return;
        }
        var authorities =
            snapshot.authorities().stream()
                .map(value -> new SimpleGrantedAuthority(value.name()))
                .toList();
        var authentication =
            UsernamePasswordAuthenticationToken.authenticated(
                new DikePrincipal(snapshot.accountId(), snapshot.authorizationVersion()),
                null,
                authorities);
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
      }
    }
    filterChain.doFilter(request, response);
  }
}
