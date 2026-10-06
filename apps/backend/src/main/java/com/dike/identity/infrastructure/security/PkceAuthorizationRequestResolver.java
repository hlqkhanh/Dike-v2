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
    return withPublicRedirect(delegate.resolve(request));
  }

  @Override
  public OAuth2AuthorizationRequest resolve(
      HttpServletRequest request, String clientRegistrationId) {
    return withPublicRedirect(delegate.resolve(request, clientRegistrationId));
  }

  private OAuth2AuthorizationRequest withPublicRedirect(OAuth2AuthorizationRequest request) {
    return request == null
        ? null
        : OAuth2AuthorizationRequest.from(request).redirectUri(redirectUri).build();
  }
}
