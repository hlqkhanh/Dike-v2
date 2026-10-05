package com.dike.identity.api;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.config.oauth2.client.CommonOAuth2Provider;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestCustomizers;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

class OAuthRequestRepositoryTest {
  @Test
  void confidentialGoogleRequestExplicitlyUsesPkceAndNonce() {
    var registration =
        CommonOAuth2Provider.GOOGLE
            .getBuilder("google")
            .clientId("synthetic")
            .clientSecret("synthetic-test-only")
            .redirectUri("http://localhost:8080/api/v1/auth/callback")
            .build();
    var resolver =
        new DefaultOAuth2AuthorizationRequestResolver(
            new InMemoryClientRegistrationRepository(registration), "/api/v1/auth");
    resolver.setAuthorizationRequestCustomizer(OAuth2AuthorizationRequestCustomizers.withPkce());
    var request = new MockHttpServletRequest("GET", "/api/v1/auth/google");
    request.setServletPath("/api/v1/auth/google");
    var auth = resolver.resolve(request);
    assertNotNull(auth);
    assertEquals("S256", auth.getAdditionalParameters().get("code_challenge_method"));
    assertNotNull(auth.getAdditionalParameters().get("nonce"));
    assertNotNull(auth.getState());
  }

  @SuppressWarnings("unchecked")
  @Test
  void callbackRequiresMatchingStateUnexpiredCookieAndAtomicClaim() {
    var redis = mock(StringRedisTemplate.class);
    ValueOperations<String, String> values = mock(ValueOperations.class);
    when(redis.opsForValue()).thenReturn(values);
    when(values.setIfAbsent(anyString(), eq("1"), any(Duration.class))).thenReturn(true, false);
    var repository = new OAuthRequestRepository(redis);
    var request = new MockHttpServletRequest();
    var response = new MockHttpServletResponse();
    var auth =
        OAuth2AuthorizationRequest.authorizationCode()
            .authorizationUri("https://accounts.google.com/o/oauth2/v2/auth")
            .clientId("test")
            .redirectUri("http://localhost:8080/api/v1/auth/callback")
            .state("test-state")
            .build();
    repository.saveAuthorizationRequest(auth, request, response);
    request.addParameter("state", "wrong");
    assertNull(repository.loadAuthorizationRequest(request));
    request.setParameter("state", "test-state");
    assertNotNull(repository.removeAuthorizationRequest(request, response));
    repository.saveAuthorizationRequest(auth, request, response);
    assertNull(repository.removeAuthorizationRequest(request, response));
    repository.saveAuthorizationRequest(auth, request, response);
    request.getSession().setAttribute("oauthIssuedAt", System.currentTimeMillis() - 300001);
    assertNull(repository.loadAuthorizationRequest(request));
    assertNull(repository.loadAuthorizationRequest(new MockHttpServletRequest()));
  }
}
