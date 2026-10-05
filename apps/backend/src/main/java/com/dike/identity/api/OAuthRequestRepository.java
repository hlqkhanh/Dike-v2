package com.dike.identity.api;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.HexFormat;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.oauth2.client.web.AuthorizationRequestRepository;
import org.springframework.security.oauth2.client.web.HttpSessionOAuth2AuthorizationRequestRepository;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

final class OAuthRequestRepository
    implements AuthorizationRequestRepository<OAuth2AuthorizationRequest> {
  private final HttpSessionOAuth2AuthorizationRequestRepository delegate =
      new HttpSessionOAuth2AuthorizationRequestRepository();
  private final StringRedisTemplate redis;

  OAuthRequestRepository(StringRedisTemplate redis) {
    this.redis = redis;
  }

  public OAuth2AuthorizationRequest loadAuthorizationRequest(HttpServletRequest request) {
    var session = request.getSession(false);
    if (session == null
        || !(session.getAttribute("oauthIssuedAt") instanceof Long issued)
        || System.currentTimeMillis() - issued > 300000) return null;
    return delegate.loadAuthorizationRequest(request);
  }

  public void saveAuthorizationRequest(
      OAuth2AuthorizationRequest value, HttpServletRequest request, HttpServletResponse response) {
    if (value != null)
      request.getSession().setAttribute("oauthIssuedAt", System.currentTimeMillis());
    delegate.saveAuthorizationRequest(value, request, response);
  }

  public OAuth2AuthorizationRequest removeAuthorizationRequest(
      HttpServletRequest request, HttpServletResponse response) {
    var value = loadAuthorizationRequest(request);
    delegate.removeAuthorizationRequest(request, response);
    if (value == null) return null;
    try {
      String digest =
          HexFormat.of()
              .formatHex(
                  MessageDigest.getInstance("SHA-256")
                      .digest(value.getState().getBytes(StandardCharsets.UTF_8)));
      return Boolean.TRUE.equals(
              redis
                  .opsForValue()
                  .setIfAbsent("dike:oauth:consumed:" + digest, "1", Duration.ofMinutes(10)))
          ? value
          : null;
    } catch (java.security.NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }
  }
}
