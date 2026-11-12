package com.dike.identity.infrastructure.security;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestCustomizers;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

final class PkceAuthorizationRequestResolver implements OAuth2AuthorizationRequestResolver {

  static final String AUTHORIZATION_BASE_URI = "/api/v1/auth/oauth2/authorization";

  private final DefaultOAuth2AuthorizationRequestResolver delegate;
  private final String redirectUri;

  PkceAuthorizationRequestResolver(
      ClientRegistrationRepository clients, URI publicBaseUrl, String registrationId) {
    this.delegate = new DefaultOAuth2AuthorizationRequestResolver(clients, AUTHORIZATION_BASE_URI);
    this.redirectUri = publicBaseUrl.resolve("/api/v1/auth/callback/" + registrationId).toString();
    delegate.setAuthorizationRequestCustomizer(OAuth2AuthorizationRequestCustomizers.withPkce());
  }

  @Override
  public OAuth2AuthorizationRequest resolve(HttpServletRequest request) {
    return customize(request, delegate.resolve(request));
  }

  @Override
  public OAuth2AuthorizationRequest resolve(
      HttpServletRequest request, String clientRegistrationId) {
    return customize(request, delegate.resolve(request, clientRegistrationId));
  }

  private OAuth2AuthorizationRequest customize(
      HttpServletRequest servletRequest, OAuth2AuthorizationRequest authorizationRequest) {
    if (authorizationRequest == null) return null;
    var builder = OAuth2AuthorizationRequest.from(authorizationRequest).redirectUri(redirectUri);
    var session = servletRequest.getSession(false);
    if (session != null && session.getAttribute(MobileLoginController.CHALLENGE) != null) {
      builder.additionalParameters(parameters -> parameters.put("prompt", "select_account"));
    }
    return builder.build();
  }
}
