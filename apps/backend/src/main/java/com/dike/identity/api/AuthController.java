package com.dike.identity.api;

import com.dike.identity.application.AuthService;
import com.dike.identity.domain.Account;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@ConditionalOnWebApplication
@io.swagger.v3.oas.annotations.responses.ApiResponse(
    responseCode = "400",
    description = "Invalid request",
    content =
        @io.swagger.v3.oas.annotations.media.Content(
            schema =
                @io.swagger.v3.oas.annotations.media.Schema(
                    implementation = com.dike.shared.api.ErrorResponse.class)))
@io.swagger.v3.oas.annotations.responses.ApiResponse(
    responseCode = "401",
    description = "Session required",
    content =
        @io.swagger.v3.oas.annotations.media.Content(
            schema =
                @io.swagger.v3.oas.annotations.media.Schema(
                    implementation = com.dike.shared.api.ErrorResponse.class)))
@io.swagger.v3.oas.annotations.responses.ApiResponse(
    responseCode = "403",
    description = "CSRF or origin rejected",
    content =
        @io.swagger.v3.oas.annotations.media.Content(
            schema =
                @io.swagger.v3.oas.annotations.media.Schema(
                    implementation = com.dike.shared.api.ErrorResponse.class)))
@io.swagger.v3.oas.annotations.responses.ApiResponse(
    responseCode = "404",
    description = "Resource unavailable",
    content =
        @io.swagger.v3.oas.annotations.media.Content(
            schema =
                @io.swagger.v3.oas.annotations.media.Schema(
                    implementation = com.dike.shared.api.ErrorResponse.class)))
@io.swagger.v3.oas.annotations.responses.ApiResponse(
    responseCode = "429",
    description = "Rate limited; Retry-After in seconds",
    content =
        @io.swagger.v3.oas.annotations.media.Content(
            schema =
                @io.swagger.v3.oas.annotations.media.Schema(
                    implementation = com.dike.shared.api.ErrorResponse.class)))
@io.swagger.v3.oas.annotations.responses.ApiResponse(
    responseCode = "503",
    description = "Dependency unavailable",
    content =
        @io.swagger.v3.oas.annotations.media.Content(
            schema =
                @io.swagger.v3.oas.annotations.media.Schema(
                    implementation = com.dike.shared.api.ErrorResponse.class)))
public class AuthController {
  private final AuthService auth;
  private final AuthSettings settings;

  public AuthController(AuthService auth, AuthSettings settings) {
    this.auth = auth;
    this.settings = settings;
  }

  @io.swagger.v3.oas.annotations.media.Schema(
      requiredProperties = {"id", "displayName", "email", "phoneStatus"})
  public record UserView(
      String id,
      String displayName,
      String email,
      String phoneE164,
      @io.swagger.v3.oas.annotations.media.Schema(
              allowableValues = {"NONE", "UNVERIFIED", "VERIFIED"})
          String phoneStatus) {
    static UserView of(Account a) {
      return new UserView(a.id(), a.displayName(), a.email(), a.phoneE164(), a.phoneStatus());
    }
  }

  @io.swagger.v3.oas.annotations.media.Schema(
      requiredProperties = {
        "user",
        "deviceSessionId",
        "issuedAt",
        "expiresAt",
        "onboardingRequired"
      })
  public record SessionView(
      UserView user,
      String deviceSessionId,
      long issuedAt,
      long expiresAt,
      boolean onboardingRequired) {}

  @io.swagger.v3.oas.annotations.media.Schema(requiredProperties = {"token"})
  public record CsrfView(String token) {}

  public record PhoneInput(@NotBlank @Size(max = 32) String phone) {}

  @io.swagger.v3.oas.annotations.media.Schema(
      requiredProperties = {"deviceSessionId", "issuedAt", "lastSeenAt", "expiresAt", "current"})
  public record DeviceView(
      String deviceSessionId, long issuedAt, long lastSeenAt, long expiresAt, boolean current) {}

  @GetMapping("/google")
  @io.swagger.v3.oas.annotations.security.SecurityRequirements
  @io.swagger.v3.oas.annotations.responses.ApiResponse(
      responseCode = "302",
      description = "Redirect to Google")
  @Operation(
      operationId = "startGoogleLogin",
      security = {})
  public void google() {
    throw new com.dike.shared.api.ApiException(
        org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,
        "GOOGLE_NOT_CONFIGURED",
        "Google login is not configured");
  }

  private AuthService.Principal principal(HttpServletRequest request) {
    return auth.require(AuthCookies.credential(request));
  }

  private AuthService.Principal mutation(HttpServletRequest request) {
    var p = principal(request);
    auth.csrf(p, request.getHeader("X-CSRF-TOKEN"));
    return p;
  }

  @GetMapping("/session")
  @SecurityRequirement(name = "sessionCookie")
  @Operation(operationId = "getSession")
  @io.swagger.v3.oas.annotations.responses.ApiResponse(
      responseCode = "200",
      description = "Success",
      useReturnTypeSchema = true)
  public SessionView session(HttpServletRequest request) {
    var p = principal(request);
    return new SessionView(
        UserView.of(p.user()),
        p.session().deviceId(),
        p.session().issuedAt(),
        p.session().expiresAt(),
        !"VERIFIED".equals(p.user().phoneStatus()));
  }

  @GetMapping("/csrf")
  @SecurityRequirement(name = "sessionCookie")
  @Operation(operationId = "getCsrf")
  @io.swagger.v3.oas.annotations.responses.ApiResponse(
      responseCode = "200",
      description = "Success",
      useReturnTypeSchema = true)
  public CsrfView csrf(HttpServletRequest request) {
    return new CsrfView(principal(request).session().csrf());
  }

  @PostMapping("/refresh")
  @SecurityRequirement(name = "sessionCookie")
  @Operation(operationId = "refreshSession")
  @io.swagger.v3.oas.annotations.responses.ApiResponse(
      responseCode = "200",
      description = "Success",
      useReturnTypeSchema = true)
  public CsrfView refresh(HttpServletRequest request, HttpServletResponse response) {
    var issued = auth.refresh(AuthCookies.credential(request), request.getHeader("X-CSRF-TOKEN"));
    AuthCookies.write(response, issued.credential(), settings.secure());
    return new CsrfView(issued.session().csrf());
  }

  @PutMapping("/phone")
  @SecurityRequirement(name = "sessionCookie")
  @Operation(operationId = "updatePhone")
  @io.swagger.v3.oas.annotations.responses.ApiResponse(
      responseCode = "200",
      description = "Success",
      useReturnTypeSchema = true)
  public UserView phone(HttpServletRequest request, @Valid @RequestBody PhoneInput input) {
    return UserView.of(auth.phone(mutation(request), input.phone()));
  }

  @GetMapping("/sessions")
  @SecurityRequirement(name = "sessionCookie")
  @Operation(operationId = "listSessions")
  @io.swagger.v3.oas.annotations.responses.ApiResponse(
      responseCode = "200",
      description = "Success",
      useReturnTypeSchema = true)
  public List<DeviceView> sessions(HttpServletRequest request) {
    var p = principal(request);
    return auth.list(p).stream()
        .map(
            s ->
                new DeviceView(
                    s.deviceId(),
                    s.issuedAt(),
                    s.lastSeenAt(),
                    s.expiresAt(),
                    s.deviceId().equals(p.session().deviceId())))
        .toList();
  }

  @DeleteMapping("/sessions/{deviceSessionId}")
  @SecurityRequirement(name = "sessionCookie")
  @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
  @Operation(operationId = "revokeSession")
  public void revoke(
      HttpServletRequest request,
      HttpServletResponse response,
      @PathVariable String deviceSessionId) {
    var p = mutation(request);
    auth.revoke(p, deviceSessionId);
    if (p.session().deviceId().equals(deviceSessionId))
      AuthCookies.clear(response, settings.secure());
  }

  @PostMapping("/logout")
  @SecurityRequirement(name = "sessionCookie")
  @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
  @Operation(operationId = "logout")
  public void logout(HttpServletRequest request, HttpServletResponse response) {
    var p = mutation(request);
    auth.revoke(p, p.session().deviceId());
    AuthCookies.clear(response, settings.secure());
  }

  @PostMapping("/logout-all")
  @SecurityRequirement(name = "sessionCookie")
  @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
  @Operation(operationId = "logoutAll")
  public void logoutAll(HttpServletRequest request, HttpServletResponse response) {
    auth.logoutAll(mutation(request));
    AuthCookies.clear(response, settings.secure());
  }
}
