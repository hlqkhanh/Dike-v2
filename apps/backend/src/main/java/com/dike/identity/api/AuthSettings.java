package com.dike.identity.api;

import java.net.URI;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnWebApplication
public record AuthSettings(
    String webUrl, String callbackUrl, boolean secure, String clientId, String clientSecret) {
  @org.springframework.beans.factory.annotation.Autowired
  public AuthSettings(
      @Value("${dike.auth.web-url:http://localhost:3000}") String webUrl,
      @Value("${dike.auth.callback-url:http://localhost:8080/api/v1/auth/callback}")
          String callbackUrl,
      @Value("${dike.environment:local}") String environment,
      @Value("${DIKE_GOOGLE_CLIENT_ID:}") String clientId,
      @Value("${DIKE_GOOGLE_CLIENT_SECRET:}") String clientSecret,
      @Value("${REQUIRE_PHONE_OTP:true}") boolean requirePhoneOtp) {
    this(
        normalizeOrigin(webUrl),
        callbackUrl,
        !environment.equals("local") && !environment.equals("test"),
        clientId,
        clientSecret);
    URI callback = URI.create(callbackUrl);
    if (clientId.isBlank() != clientSecret.isBlank())
      throw new IllegalArgumentException("Google client ID and secret must be configured together");
    if (secure
        && (!webUrl.startsWith("https://")
            || !callbackUrl.startsWith("https://")
            || clientId.isBlank()
            || clientSecret.isBlank()
            || !requirePhoneOtp))
      throw new IllegalArgumentException(
          "Hosted authentication requires HTTPS, Google configuration and OTP");
    if (!validHttpUri(callback)
        || callback.getQuery() != null
        || callback.getFragment() != null
        || !"/api/v1/auth/callback".equals(callback.getRawPath()))
      throw new IllegalArgumentException("Invalid OAuth callback");
  }

  private static boolean validHttpUri(URI uri) {
    return ("http".equals(uri.getScheme()) || "https".equals(uri.getScheme()))
        && uri.getHost() != null
        && uri.getUserInfo() == null
        && (uri.getPort() == -1 || uri.getPort() > 0 && uri.getPort() <= 65535);
  }

  private static String normalizeOrigin(String value) {
    URI uri = URI.create(value);
    if (!validHttpUri(uri)
        || uri.getQuery() != null
        || uri.getFragment() != null
        || !(uri.getRawPath().isEmpty() || uri.getRawPath().equals("/")))
      throw new IllegalArgumentException("Invalid web origin");
    return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
  }

  @Override
  public String toString() {
    return "AuthSettings[webUrl="
        + webUrl
        + ", callbackUrl="
        + callbackUrl
        + ", secure="
        + secure
        + ", credentials=[REDACTED]]";
  }
}
