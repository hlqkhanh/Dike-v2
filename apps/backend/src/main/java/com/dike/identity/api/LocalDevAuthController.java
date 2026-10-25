package com.dike.identity.api;

import com.dike.identity.application.ConsentService;
import com.dike.identity.application.GoogleIdentityClaims;
import com.dike.identity.application.IdentityProvisioningService;
import com.dike.identity.application.MobileSessionTokens;
import com.dike.identity.domain.AccountRole;
import com.dike.identity.domain.ConsentDecision;
import com.dike.identity.domain.ConsentType;
import com.dike.identity.infrastructure.security.SessionAttributes;
import com.dike.shared.api.ApiException;
import io.swagger.v3.oas.annotations.Hidden;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.bson.Document;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Local-only login helper. The bean does not exist in staging or production. */
@RestController
@RequestMapping("/api/v1/auth/dev")
@ConditionalOnExpression(
    "'${dike.environment:local}' == 'local' && ${dike.auth.dev-login-enabled:false}")
public class LocalDevAuthController {
  private final IdentityProvisioningService identities;
  private final ConsentService consents;
  private final MongoTemplate mongo;
  private final Clock clock;
  private final URI publicBaseUrl;
  private final Duration idleTimeout;
  private final Duration absoluteLifetime;
  private final Set<String> allowedOrigins;

  public LocalDevAuthController(
      IdentityProvisioningService identities,
      ConsentService consents,
      MongoTemplate mongo,
      Clock clock,
      @Value("${dike.auth.allowed-origins:http://localhost:3000}") List<URI> allowedOrigins,
      @Value("${dike.auth.public-base-url:http://localhost:3000}") URI publicBaseUrl,
      @Value("${dike.auth.session.idle-timeout:24h}") Duration idleTimeout,
      @Value("${dike.auth.session.absolute-lifetime:30d}") Duration absoluteLifetime) {
    this.identities = identities;
    this.consents = consents;
    this.mongo = mongo;
    this.clock = clock;
    this.allowedOrigins =
        allowedOrigins.stream()
            .map(LocalDevAuthController::origin)
            .collect(java.util.stream.Collectors.toUnmodifiableSet());
    this.publicBaseUrl = publicBaseUrl;
    this.idleTimeout = idleTimeout;
    this.absoluteLifetime = absoluteLifetime;
  }

  @GetMapping
  void login(
      @RequestParam(defaultValue = "member") String persona,
      HttpServletRequest request,
      HttpServletResponse response)
      throws IOException {
    createSession(request, provisionPersona(persona), false);
    response.sendRedirect(publicBaseUrl.resolve("/feed?devSession=true").toString());
  }

  @Hidden
  @GetMapping(value = "/mobile", headers = "X-Dike-Client=mobile")
  MobileLoginResponse mobile(
      @RequestParam(defaultValue = "member") String persona, HttpServletRequest request) {
    String browserOrigin = request.getHeader("Origin");
    if (browserOrigin == null || browserOrigin.isBlank()) {
      browserOrigin = request.getHeader("Referer");
    }
    if (browserOrigin != null && !allowedOrigin(browserOrigin)) {
      throw new ApiException(
          HttpStatus.FORBIDDEN, "NATIVE_CLIENT_REQUIRED", "Chỉ dùng cho ứng dụng local");
    }
    HttpSession session = createSession(request, provisionPersona(persona), true);
    return new MobileLoginResponse(
        MobileSessionTokens.tokenFor(session),
        (Instant) session.getAttribute(SessionAttributes.ABSOLUTE_EXPIRES_AT));
  }

  public record MobileLoginResponse(String token, Instant expiresAt) {}

  private String provisionPersona(String persona) {
    String safePersona = persona.toLowerCase(Locale.ROOT);
    if (!Set.of("member", "driver", "admin").contains(safePersona)) safePersona = "member";
    var user =
        identities.provisionGoogle(
            new GoogleIdentityClaims(
                "https://local.dike.invalid",
                "dev-" + safePersona,
                safePersona + "@local.dike.invalid",
                true,
                switch (safePersona) {
                  case "admin" -> "Quản trị viên thử nghiệm";
                  case "driver" -> "Tài xế thử nghiệm";
                  default -> "Thành viên thử nghiệm";
                },
                null));

    List<AccountRole> roles =
        switch (safePersona) {
          case "admin" ->
              List.of(AccountRole.ADMIN, AccountRole.MODERATOR, AccountRole.APPROVED_DRIVER);
          case "driver" -> List.of(AccountRole.APPROVED_DRIVER);
          default -> List.of();
        };
    mongo.updateFirst(
        Query.query(Criteria.where("_id").is(user.id())),
        new Update()
            .set("onboardingStatus", "PHONE_SUBMITTED")
            .set("phoneE164", "+84900000999")
            .set("phoneStatus", "UNVERIFIED")
            .set("assignedRoles", roles),
        "users");
    for (ConsentType type : ConsentType.values()) {
      consents.decide(user.id(), type, ConsentDecision.ACCEPTED, "vi");
    }
    ensureProfile(user.id(), user.displayName());
    return user.id();
  }

  private void ensureProfile(String userId, String displayName) {
    if (mongo.exists(Query.query(Criteria.where("_id").is(userId)), "user_profiles")) return;
    Instant now = clock.instant();
    mongo.insert(
        new Document("_id", userId)
            .append("displayName", displayName)
            .append("normalizedDisplayName", displayName.toLowerCase(Locale.ROOT))
            .append("bio", "Tài khoản dùng để kiểm thử giao diện local.")
            .append("createdAt", now)
            .append("updatedAt", now)
            .append("version", 0L),
        "user_profiles");
    mongo.insert(
        new Document("_id", userId)
            .append("profileVisibility", "MEMBERS")
            .append("discoverableByName", true)
            .append("allowMessageRequests", true)
            .append("updatedAt", now)
            .append("version", 0L),
        "user_privacy_settings");
  }

  private HttpSession createSession(HttpServletRequest request, String userId, boolean mobile) {
    Instant now = clock.instant();
    HttpSession existing = request.getSession(false);
    if (existing != null) existing.invalidate();
    HttpSession session = request.getSession(true);
    session.setMaxInactiveInterval((int) idleTimeout.toSeconds());
    session.setAttribute(SessionAttributes.HANDLE, UUID.randomUUID().toString());
    session.setAttribute(SessionAttributes.CREATED_AT, now);
    session.setAttribute(SessionAttributes.LAST_SEEN_AT, now);
    session.setAttribute(SessionAttributes.ABSOLUTE_EXPIRES_AT, now.plus(absoluteLifetime));
    session.setAttribute(
        SessionAttributes.DEVICE_LABEL,
        mobile ? "Ứng dụng Dike local" : "Trình duyệt phát triển local");
    session.setAttribute(SessionAttributes.MOBILE, mobile);
    session.setAttribute(SessionAttributes.ACCOUNT_ID, userId);
    session.setAttribute(SessionAttributes.GOOGLE_AUTHENTICATED_AT, now);
    session.setAttribute(FindByIndexNameSessionRepository.PRINCIPAL_NAME_INDEX_NAME, userId);
    return session;
  }

  private boolean allowedOrigin(String candidate) {
    try {
      return allowedOrigins.contains(origin(URI.create(candidate)));
    } catch (IllegalArgumentException exception) {
      return false;
    }
  }

  private static String origin(URI uri) {
    if (uri.getScheme() == null || uri.getHost() == null) throw new IllegalArgumentException();
    return uri.getScheme()
        + "://"
        + uri.getHost()
        + (uri.getPort() < 0 ? "" : ":" + uri.getPort());
  }
}
