package com.dike.identity.api;

import com.dike.identity.api.AuthResponses.AuthSessionResponse;
import com.dike.identity.api.AuthResponses.SessionListResponse;
import com.dike.identity.application.AuthTelemetry;
import com.dike.identity.application.DikePrincipal;
import com.dike.identity.application.LoginRateLimiter;
import com.dike.identity.application.OtpOperations;
import com.dike.identity.application.PhoneOnboardingService;
import com.dike.identity.application.SessionApplicationService;
import com.dike.identity.infrastructure.security.MobileSessionIdResolver;
import com.dike.shared.api.ApiException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.io.IOException;
import java.time.Instant;
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
import org.springframework.web.bind.annotation.RequestHeader;
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
  private final OtpOperations otp;

  public AuthController(
      SessionApplicationService sessions,
      PhoneOnboardingService phones,
      CsrfTokenRepository csrfTokens,
      LoginRateLimiter loginRateLimiter,
      AuthTelemetry telemetry,
      OtpOperations otp) {
    this.sessions = sessions;
    this.phones = phones;
    this.csrfTokens = csrfTokens;
    this.loginRateLimiter = loginRateLimiter;
    this.telemetry = telemetry;
    this.otp = otp;
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
  @Operation(operationId = "getAuthSession")
  @SecurityRequirement(name = "sessionCookie")
  AuthSessionResponse current(
      @AuthenticationPrincipal DikePrincipal principal,
      HttpServletRequest request,
      CsrfToken csrfToken) {
    if (!MobileSessionIdResolver.isAuthenticatedMobileRequest(request)) csrfToken.getToken();
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
      phones.submit(
          principal.userId(),
          body.phoneNumber(),
          body.expectedPhoneVersion(),
          (Instant)
              request
                  .getSession()
                  .getAttribute(
                      com.dike.identity.infrastructure.security.SessionAttributes
                          .GOOGLE_AUTHENTICATED_AT));
      return sessions.current(principal, request.getSession());
    } catch (PhoneOnboardingService.InvalidPhoneException exception) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "PHONE_INVALID", exception.getMessage());
    } catch (com.dike.identity.application.StalePhoneVersionException exception) {
      throw new ApiException(
          HttpStatus.CONFLICT, "PHONE_STATE_CHANGED", "Trạng thái số điện thoại đã thay đổi");
    } catch (PhoneOnboardingService.ReauthenticationRequiredException exception) {
      throw new ApiException(HttpStatus.FORBIDDEN, "REAUTH_REQUIRED", exception.getMessage());
    }
  }

  @PostMapping("/otp")
  @SecurityRequirement(name = "sessionCookie")
  ResponseEntity<OtpOperations.ChallengeView> issueOtp(
      @AuthenticationPrincipal DikePrincipal principal,
      @Valid @RequestBody OtpRequests.Issue body,
      @RequestHeader("Idempotency-Key") String requestKey,
      HttpServletRequest request) {
    try {
      var challenge =
          otp.issue(
              principal.userId(),
              sessionHandle(request),
              request.getRemoteAddr(),
              body.purpose(),
              body.phoneVersion(),
              requestKey);
      return ResponseEntity.accepted().body(challenge);
    } catch (OtpOperations.OtpException exception) {
      throw otpError(exception);
    }
  }

  @GetMapping("/otp/{challengeId}")
  @SecurityRequirement(name = "sessionCookie")
  OtpOperations.ChallengeView otpStatus(
      @AuthenticationPrincipal DikePrincipal principal,
      @PathVariable String challengeId,
      HttpServletRequest request) {
    try {
      return otp.status(principal.userId(), sessionHandle(request), challengeId);
    } catch (OtpOperations.OtpException exception) {
      throw otpError(exception);
    }
  }

  @PostMapping("/otp/{challengeId}/verify")
  @SecurityRequirement(name = "sessionCookie")
  AuthSessionResponse verifyOtp(
      @AuthenticationPrincipal DikePrincipal principal,
      @PathVariable String challengeId,
      @Valid @RequestBody OtpRequests.Verify body,
      @RequestHeader("Idempotency-Key") String requestKey,
      HttpServletRequest request) {
    try {
      otp.verify(
          principal.userId(),
          sessionHandle(request),
          request.getRemoteAddr(),
          challengeId,
          body.code(),
          requestKey);
      return sessions.current(principal, request.getSession());
    } catch (OtpOperations.OtpException exception) {
      throw otpError(exception);
    }
  }

  @DeleteMapping("/otp/{challengeId}")
  @SecurityRequirement(name = "sessionCookie")
  ResponseEntity<Void> cancelOtp(
      @AuthenticationPrincipal DikePrincipal principal,
      @PathVariable String challengeId,
      HttpServletRequest request) {
    try {
      otp.cancel(principal.userId(), sessionHandle(request), challengeId);
      return ResponseEntity.noContent().build();
    } catch (OtpOperations.OtpException exception) {
      throw otpError(exception);
    }
  }

  private String sessionHandle(HttpServletRequest request) {
    return (String)
        request
            .getSession()
            .getAttribute(com.dike.identity.infrastructure.security.SessionAttributes.HANDLE);
  }

  private ApiException otpError(OtpOperations.OtpException exception) {
    return switch (exception.reason()) {
      case CHALLENGE_NOT_FOUND ->
          new ApiException(HttpStatus.NOT_FOUND, "OTP_NOT_FOUND", "Không tìm thấy mã xác minh");
      case PHONE_STATE_CHANGED, CHALLENGE_NOT_ACTIVE ->
          new ApiException(
              HttpStatus.CONFLICT, "OTP_STATE_CHANGED", "Trạng thái xác minh đã thay đổi");
      case CODE_INVALID ->
          new ApiException(
              HttpStatus.BAD_REQUEST, "OTP_INVALID", "Mã xác minh không hợp lệ hoặc đã hết hạn");
      case DELIVERY_FAILED, SEND_DISABLED ->
          new ApiException(
              HttpStatus.SERVICE_UNAVAILABLE, "OTP_UNAVAILABLE", "Chưa thể gửi mã xác minh");
      case PHONE_REQUIRED ->
          new ApiException(
              HttpStatus.CONFLICT, "PHONE_REQUIRED", "Bạn cần nhập số điện thoại trước");
      case RATE_LIMITED ->
          new ApiException(
              HttpStatus.TOO_MANY_REQUESTS,
              "OTP_RATE_LIMITED",
              "Đã có quá nhiều yêu cầu xác minh",
              exception.retryAfter());
    };
  }
}
