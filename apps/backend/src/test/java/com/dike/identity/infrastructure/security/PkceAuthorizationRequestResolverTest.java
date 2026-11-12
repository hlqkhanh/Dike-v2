package com.dike.identity.infrastructure.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.endpoint.PkceParameterNames;

class PkceAuthorizationRequestResolverTest {

  @Test
  void alwaysAddsS256PkceToGoogleAuthorizationRequest() {
    ClientRegistration google =
        ClientRegistration.withRegistrationId("google")
            .clientId("client-id")
            .clientSecret("client-secret")
            .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
            .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
            .redirectUri("{baseUrl}/api/v1/auth/callback/{registrationId}")
            .scope(Set.of("openid", "email", "profile"))
            .authorizationUri("https://accounts.google.com/o/oauth2/v2/auth")
            .tokenUri("https://oauth2.googleapis.com/token")
            .jwkSetUri("https://www.googleapis.com/oauth2/v3/certs")
            .issuerUri("https://accounts.google.com")
            .userInfoUri("https://openidconnect.googleapis.com/v1/userinfo")
            .userNameAttributeName("sub")
            .clientName("Google")
            .build();
    var resolver =
        new PkceAuthorizationRequestResolver(
            new InMemoryClientRegistrationRepository(google),
            URI.create("https://app.dike.test"),
            "google");
    MockHttpServletRequest request =
        new MockHttpServletRequest(
            "GET", PkceAuthorizationRequestResolver.AUTHORIZATION_BASE_URI + "/google");
    request.setServletPath(PkceAuthorizationRequestResolver.AUTHORIZATION_BASE_URI + "/google");

    var authorization = resolver.resolve(request);

    assertThat(authorization).isNotNull();
    assertThat(authorization.getRedirectUri())
        .isEqualTo("https://app.dike.test/api/v1/auth/callback/google");
    assertThat(authorization.getAdditionalParameters())
        .containsEntry(PkceParameterNames.CODE_CHALLENGE_METHOD, "S256")
        .containsKey(PkceParameterNames.CODE_CHALLENGE);
    assertThat(authorization.getAttributes()).containsKey(PkceParameterNames.CODE_VERIFIER);
  }

  @Test
  void mobileLoginAlwaysPromptsForTheIntendedGoogleAccount() {
    ClientRegistration google =
        ClientRegistration.withRegistrationId("google")
            .clientId("client-id")
            .clientSecret("client-secret")
            .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
            .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
            .redirectUri("{baseUrl}/api/v1/auth/callback/{registrationId}")
            .scope(Set.of("openid", "email", "profile"))
            .authorizationUri("https://accounts.google.com/o/oauth2/v2/auth")
            .tokenUri("https://oauth2.googleapis.com/token")
            .jwkSetUri("https://www.googleapis.com/oauth2/v3/certs")
            .issuerUri("https://accounts.google.com")
            .userInfoUri("https://openidconnect.googleapis.com/v1/userinfo")
            .userNameAttributeName("sub")
            .clientName("Google")
            .build();
    var resolver =
        new PkceAuthorizationRequestResolver(
            new InMemoryClientRegistrationRepository(google),
            URI.create("https://app.dike.test"),
            "google");
    MockHttpServletRequest request =
        new MockHttpServletRequest(
            "GET", PkceAuthorizationRequestResolver.AUTHORIZATION_BASE_URI + "/google");
    request.setServletPath(PkceAuthorizationRequestResolver.AUTHORIZATION_BASE_URI + "/google");
    request.getSession(true).setAttribute(MobileLoginController.CHALLENGE, "challenge");

    var authorization = resolver.resolve(request);

    assertThat(authorization).isNotNull();
    assertThat(authorization.getAdditionalParameters()).containsEntry("prompt", "select_account");
  }
}
