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
        webUrl,
        callbackUrl,
        !environment.equals("local") && !environment.equals("test"),
        clientId,
        clientSecret);
    URI web = URI.create(webUrl), callback = URI.create(callbackUrl);
    if (web.getHost() == null
        || web.getUserInfo() != null
        || web.getQuery() != null
        || web.getFragment() != null
        || !(web.getPath().isEmpty() || web.getPath().equals("/")))
      throw new IllegalArgumentException("Invalid web origin");
    if (secure
        && (!webUrl.startsWith("https://")
            || !callbackUrl.startsWith("https://")
            || clientId.isBlank()
            || clientSecret.isBlank()
            || !requirePhoneOtp))
      throw new IllegalArgumentException(
          "Hosted authentication requires HTTPS, Google configuration and OTP");
    if (!"/api/v1/auth/callback".equals(callback.getPath()))
      throw new IllegalArgumentException("Invalid OAuth callback");
  }
}
