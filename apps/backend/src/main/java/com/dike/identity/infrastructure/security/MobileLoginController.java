package com.dike.identity.infrastructure.security;

import com.dike.identity.api.MobileLoginExchange.ExchangeRequest;
import com.dike.identity.api.MobileLoginExchange.ExchangeResponse;
import com.dike.identity.application.LoginRateLimiter;
import com.dike.identity.application.MobileSessionTokens;
import com.dike.shared.api.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

/** One-use, short-lived, S256-bound handoff from browser Google login to the native app. */
@RestController
@RequestMapping("/api/v1/auth/mobile")
public class MobileLoginController {
  public static final String CHALLENGE = "dike.mobile.challenge";
  public static final String STATE = "dike.mobile.state";
  public static final String CALLBACK = "dike.mobile.callback";
  private static final String PREFIX = "dike:auth:mobile:";
  private final StringRedisTemplate redis;
  private final LoginRateLimiter limiter;
  private final Set<String> allowedBrowserCallbacks;
  private final org.springframework.session.web.http.HttpSessionIdResolver sessionIdResolver;

  public MobileLoginController(
      StringRedisTemplate redis,
      LoginRateLimiter limiter,
      @Value("${dike.auth.allowed-origins:http://localhost:3000}") List<URI> allowedOrigins) {
    this(redis, limiter, allowedOrigins, null);
  }

  @org.springframework.beans.factory.annotation.Autowired
  public MobileLoginController(
      StringRedisTemplate redis,
      LoginRateLimiter limiter,
      @Value("${dike.auth.allowed-origins:http://localhost:3000}") List<URI> allowedOrigins,
      @org.springframework.beans.factory.annotation.Autowired(required = false)
          org.springframework.session.web.http.HttpSessionIdResolver sessionIdResolver) {
    this.redis = redis;
    this.limiter = limiter;
    this.allowedBrowserCallbacks =
        allowedOrigins.stream()
            .map(MobileLoginController::origin)
            .collect(Collectors.toUnmodifiableSet());
    this.sessionIdResolver = sessionIdResolver;
  }

  @GetMapping("/google")
  void start(
      @RequestParam String challenge,
      @RequestParam String state,
      @RequestParam(required = false) String callback,
      HttpServletRequest request,
      HttpServletResponse response)
      throws IOException {
    limit(request);
    if (!challenge.matches("[A-Za-z0-9_-]{43}") || !state.matches("[A-Za-z0-9_-]{32,128}")) {
      throw invalid();
    }
    request.getSession(true).setAttribute(CHALLENGE, challenge);
    request.getSession().setAttribute(STATE, state);
    if (callback != null && !callback.isBlank()) {
      URI callbackUri;
      try {
        callbackUri = URI.create(callback);
      } catch (IllegalArgumentException exception) {
        throw invalid();
      }
      if (!"/auth/callback".equals(callbackUri.getPath())
          || callbackUri.getQuery() != null
          || callbackUri.getFragment() != null
          || !allowedBrowserCallbacks.contains(origin(callbackUri))) {
        throw invalid();
      }
      request.getSession().setAttribute(CALLBACK, callbackUri.toString());
    }
    response.sendRedirect("/api/v1/auth/google");
  }

  void start(
      String challenge,
      String state,
      HttpServletRequest request,
      HttpServletResponse response)
      throws IOException {
    start(challenge, state, null, request, response);
  }

  @GetMapping("/complete")
  void complete(HttpServletRequest request, HttpServletResponse response) throws IOException {
    var session = request.getSession(false);
    String challenge = session == null ? null : (String) session.getAttribute(CHALLENGE);
    String state = session == null ? null : (String) session.getAttribute(STATE);
    String callback = session == null ? null : (String) session.getAttribute(CALLBACK);
    if (challenge == null
        || state == null
        || session.getAttribute(SessionAttributes.ACCOUNT_ID) == null) {
      throw invalid();
    }
    session.removeAttribute(CHALLENGE);
    session.removeAttribute(STATE);
    session.removeAttribute(CALLBACK);
    session.setAttribute(SessionAttributes.MOBILE, true);
    if (sessionIdResolver != null) {
      sessionIdResolver.expireSession(request, response);
    }
    String code = UUID.randomUUID().toString();
    redis
        .opsForValue()
        .set(PREFIX + code, challenge + ":" + MobileSessionTokens.tokenFor(session), Duration.ofSeconds(60));
    // Fixed redirect prevents open redirects and credential delivery to arbitrary applications.
    String destination = callback == null ? "dike://auth/callback" : callback;
    response.sendRedirect(destination + "?code=" + code + "&state=" + state);
  }

  @PostMapping("/exchange")
  ExchangeResponse exchange(@Valid @RequestBody ExchangeRequest body, HttpServletRequest request) {
    limit(request);
    if (body.code() == null || body.verifier() == null) throw invalid();
    String grant = redis.opsForValue().getAndDelete(PREFIX + body.code());
    if (grant == null) throw invalid();
    String[] parts = grant.split(":", 2);
    if (parts.length != 2
        || !MessageDigest.isEqual(
            parts[0].getBytes(StandardCharsets.US_ASCII),
            challenge(body.verifier()).getBytes(StandardCharsets.US_ASCII))) {
      throw invalid();
    }
    return new ExchangeResponse(parts[1]);
  }

  static String challenge(String verifier) {
    try {
      return Base64.getUrlEncoder()
          .withoutPadding()
          .encodeToString(
              MessageDigest.getInstance("SHA-256")
                  .digest(verifier.getBytes(StandardCharsets.US_ASCII)));
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException(exception);
    }
  }

  private void limit(HttpServletRequest request) {
    if (!limiter.tryAcquireLogin(request.getRemoteAddr())) {
      throw new ApiException(
          HttpStatus.TOO_MANY_REQUESTS, "AUTH_RATE_LIMITED", "Vui lòng thử lại sau.");
    }
  }

  private static ApiException invalid() {
    return new ApiException(
        HttpStatus.BAD_REQUEST,
        "MOBILE_LOGIN_INVALID",
        "Phiên đăng nhập đã hết hạn hoặc không hợp lệ.");
  }

  private static String origin(URI uri) {
    if (uri.getScheme() == null || uri.getHost() == null) throw new IllegalArgumentException();
    return uri.getScheme()
        + "://"
        + uri.getHost()
        + (uri.getPort() < 0 ? "" : ":" + uri.getPort());
  }
}
