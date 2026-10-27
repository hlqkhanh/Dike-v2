package com.dike.identity.infrastructure.security;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.dike.identity.application.LoginRateLimiter;
import com.dike.shared.api.ApiException;
import java.time.Duration;
import java.net.URI;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class MobileLoginControllerTest {
  private final StringRedisTemplate redis = mock(StringRedisTemplate.class);

  @SuppressWarnings("unchecked")
  private final ValueOperations<String, String> values = mock(ValueOperations.class);

  private final LoginRateLimiter limiter = mock(LoginRateLimiter.class);
  private final org.springframework.session.web.http.HttpSessionIdResolver sessionIdResolver =
      mock(org.springframework.session.web.http.HttpSessionIdResolver.class);
  private final MobileLoginController controller =
      new MobileLoginController(
          redis, limiter, List.of(URI.create("http://localhost:8081")), sessionIdResolver);
  private final MockHttpServletRequest request = new MockHttpServletRequest();
  private final String verifier = "a".repeat(64);
  private final String code = "00000000-0000-0000-0000-000000000000";

  @BeforeEach
  void setup() {
    when(redis.opsForValue()).thenReturn(values);
    when(limiter.tryAcquireLogin(any())).thenReturn(true);
  }

  @Test
  void usesS256ChallengeAndOnlyReturnsCredentialForMatchingVerifier() {
    assertThat(MobileLoginController.challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"))
        .isEqualTo("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
    when(values.getAndDelete("dike:auth:mobile:" + code))
        .thenReturn(
            MobileLoginController.challenge(verifier) + ":session-credential", (String) null);
    assertThat(
            controller
                .exchange(new com.dike.identity.api.MobileLoginExchange.ExchangeRequest(code, verifier), request)
                .token())
        .isEqualTo("session-credential");
    assertThatThrownBy(
            () ->
                controller.exchange(
                    new com.dike.identity.api.MobileLoginExchange.ExchangeRequest(code, verifier), request))
        .isInstanceOf(ApiException.class);
  }

  @Test
  void rejectsWrongVerifierAndExpiredCode() {
    when(values.getAndDelete(anyString())).thenReturn("wrong:credential", (String) null);
    assertThatThrownBy(
            () ->
                controller.exchange(
                    new com.dike.identity.api.MobileLoginExchange.ExchangeRequest(code, verifier), request))
        .isInstanceOf(ApiException.class);
    assertThatThrownBy(
            () ->
                controller.exchange(
                    new com.dike.identity.api.MobileLoginExchange.ExchangeRequest(code, verifier), request))
        .isInstanceOf(ApiException.class);
  }

  @Test
  void completesToFixedAppCallbackWithShortLivedGrantAndClearsChallenge() throws Exception {
    var session = request.getSession();
    session.setAttribute(
        MobileLoginController.CHALLENGE, MobileLoginController.challenge(verifier));
    session.setAttribute(MobileLoginController.STATE, "s".repeat(32));
    session.setAttribute(SessionAttributes.ACCOUNT_ID, "member");
    var response = new MockHttpServletResponse();
    controller.complete(request, response);
    assertThat(response.getRedirectedUrl())
        .startsWith("dike://auth/callback?code=")
        .endsWith("&state=" + "s".repeat(32));
    verify(values)
        .set(
            startsWith("dike:auth:mobile:"),
            eq(MobileLoginController.challenge(verifier) + ":dike-mobile." + session.getId()),
            eq(Duration.ofSeconds(60)));
    verify(sessionIdResolver).expireSession(request, response);
    assertThat(session.getAttribute(MobileLoginController.CHALLENGE)).isNull();
    assertThatThrownBy(() -> controller.complete(request, response))
        .isInstanceOf(ApiException.class);
  }

  @Test
  void rejectsMalformedStartAndRateLimitedExchange() {
    assertThatThrownBy(() -> controller.start("bad", "bad", request, new MockHttpServletResponse()))
        .isInstanceOf(ApiException.class);
    when(limiter.tryAcquireLogin(any())).thenReturn(false);
    assertThatThrownBy(
            () ->
                controller.exchange(
                    new com.dike.identity.api.MobileLoginExchange.ExchangeRequest(code, verifier), request))
        .isInstanceOf(ApiException.class);
  }
}
