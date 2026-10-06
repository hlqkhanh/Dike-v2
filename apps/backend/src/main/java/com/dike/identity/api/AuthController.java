package com.dike.identity.api;

import com.dike.identity.api.AuthResponses.AuthSessionResponse;
import com.dike.identity.api.AuthResponses.SessionListResponse;
import com.dike.identity.application.AuthTelemetry;
import com.dike.identity.application.DikePrincipal;
import com.dike.identity.application.LoginRateLimiter;
import com.dike.identity.application.PhoneOnboardingService;
import com.dike.identity.application.SessionApplicationService;
import com.dike.shared.api.ApiException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

  private final SessionApplicationService sessions;
  private final PhoneOnboardingService phones;
  private final CsrfTokenRepository csrfTokens;
  private final LoginRateLimiter loginRateLimiter;
  private final AuthTelemetry telemetry;

  public AuthController(
      SessionApplicationService sessions,
      PhoneOnboardingService phones,
      CsrfTokenRepository csrfTokens,
      LoginRateLimiter loginRateLimiter,
      AuthTelemetry telemetry) {
    this.sessions = sessions;
    this.phones = phones;
    this.csrfTokens = csrfTokens;
    this.loginRateLimiter = loginRateLimiter;
    this.telemetry = telemetry;
  }

  @GetMapping("/google")
  @Operation(summary = "Start Google login")
  void google(HttpServletRequest request, HttpServletResponse response) throws IOException {
    if (!loginRateLimiter.tryAcquireLogin(request.getRemoteAddr())) {
      telemetry.login("rate_limited");
      throw new ApiException(
          HttpStatus.TOO_MANY_REQUESTS, "AUTH_RATE_LIMITED", "Đã có quá nhiều yêu cầu đăng nhập");
    }
    response.sendRedirect("/api/v1/auth/oauth2/authorization/google");
  }

  @GetMapping("/session")
  @SecurityRequirement(name = "sessionCookie")
  AuthSessionResponse current(
      @AuthenticationPrincipal DikePrincipal principal,
      HttpServletRequest request,
      CsrfToken csrfToken) {
    csrfToken.getToken();
    return sessions.current(principal, request.getSession());
  }

  @PostMapping("/session/refresh")
  @SecurityRequirement(name = "sessionCookie")
  AuthSessionResponse refresh(
      @AuthenticationPrincipal DikePrincipal principal,
      HttpServletRequest request,
      HttpServletResponse response) {
    request.changeSessionId();
    csrfTokens.saveToken(csrfTokens.generateToken(request), request, response);
    telemetry.session("refreshed");
    return sessions.current(principal, request.getSession());
  }

  @GetMapping("/sessions")
  @SecurityRequirement(name = "sessionCookie")
  SessionListResponse list(
      @AuthenticationPrincipal DikePrincipal principal, HttpServletRequest request) {
    return sessions.list(principal, request.getSession().getId());
  }

  @DeleteMapping("/sessions/{sessionHandle}")
  @SecurityRequirement(name = "sessionCookie")
  ResponseEntity<Void> revoke(
      @AuthenticationPrincipal DikePrincipal principal,
      @PathVariable String sessionHandle,
      HttpServletRequest request) {
    if (!sessions.revoke(principal, sessionHandle, request)) {
      throw new ApiException(HttpStatus.NOT_FOUND, "SESSION_NOT_FOUND", "Không tìm thấy phiên");
    }
    telemetry.session("revoked");
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/logout")
  @SecurityRequirement(name = "sessionCookie")
  ResponseEntity<Void> logout(HttpServletRequest request) {
    request.getSession(false).invalidate();
    telemetry.session("logout_current");
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/logout-all")
  @SecurityRequirement(name = "sessionCookie")
  ResponseEntity<Void> logoutAll(
      @AuthenticationPrincipal DikePrincipal principal, HttpServletRequest request) {
    sessions.logoutAll(principal, request);
    telemetry.session("logout_all");
    return ResponseEntity.noContent().build();
  }

  @PutMapping("/phone")
  @SecurityRequirement(name = "sessionCookie")
  AuthSessionResponse phone(
      @AuthenticationPrincipal DikePrincipal principal,
      @Valid @RequestBody PhoneRequest body,
      HttpServletRequest request) {
    try {
      phones.submit(principal.userId(), body.phoneNumber());
      return sessions.current(principal, request.getSession());
    } catch (PhoneOnboardingService.InvalidPhoneException exception) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "PHONE_INVALID", exception.getMessage());
    }
  }
}
