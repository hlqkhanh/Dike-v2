package com.dike.identity.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.dike.identity.application.ConsentService;
import com.dike.identity.application.IdentityProvisioningService;
import com.dike.identity.domain.UserAccount;
import com.dike.identity.infrastructure.security.SessionAttributes;
import com.dike.shared.api.ApiException;
import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.boot.convert.ApplicationConversionService;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.mock.web.MockHttpServletRequest;

class LocalDevAuthControllerTest {
  @Test
  void localHelperIsAbsentUnlessExplicitlyEnabledInLocalEnvironment() {
    var runner =
        new ApplicationContextRunner()
            .withInitializer(
                context ->
                    context
                        .getBeanFactory()
                        .setConversionService(ApplicationConversionService.getSharedInstance()))
            .withUserConfiguration(LocalDevAuthController.class)
            .withBean(
                IdentityProvisioningService.class, () -> mock(IdentityProvisioningService.class))
            .withBean(ConsentService.class, () -> mock(ConsentService.class))
            .withBean(MongoTemplate.class, () -> mock(MongoTemplate.class))
            .withBean(Clock.class, Clock::systemUTC);
    runner
        .withPropertyValues("dike.environment=local", "dike.auth.dev-login-enabled=true")
        .run(context -> assertThat(context).hasSingleBean(LocalDevAuthController.class));
    runner
        .withPropertyValues("dike.environment=local", "dike.auth.dev-login-enabled=false")
        .run(context -> assertThat(context).doesNotHaveBean(LocalDevAuthController.class));
    for (String environment : new String[] {"staging", "production"}) {
      runner
          .withPropertyValues("dike.environment=" + environment, "dike.auth.dev-login-enabled=true")
          .run(context -> assertThat(context).doesNotHaveBean(LocalDevAuthController.class));
    }
  }

  @Test
  void createsExpiringNativeCredentialAndRejectsBrowserBootstrap() {
    var identities = mock(IdentityProvisioningService.class);
    var mongo = mock(MongoTemplate.class);
    var user = mock(UserAccount.class);
    when(user.id()).thenReturn("local-member");
    when(user.displayName()).thenReturn("Local member");
    when(identities.provisionGoogle(any())).thenReturn(user);
    Instant now = Instant.parse("2026-10-19T00:00:00Z");
    var controller =
        new LocalDevAuthController(
            identities,
            mock(ConsentService.class),
            mongo,
            Clock.fixed(now, ZoneOffset.UTC),
            List.of(URI.create("http://localhost:8081")),
            URI.create("http://localhost:3000"),
            Duration.ofHours(24),
            Duration.ofDays(30));
    var request = new MockHttpServletRequest("GET", "/api/v1/auth/dev/mobile");
    var result = controller.mobile("member", request);
    assertThat(result.token()).isEqualTo("dike-mobile." + request.getSession(false).getId());
    assertThat(result.expiresAt()).isEqualTo(now.plus(Duration.ofDays(30)));
    assertThat(request.getSession(false).getAttribute(SessionAttributes.MOBILE)).isEqualTo(true);
    assertThat(request.getSession(false).getAttribute(SessionAttributes.ACCOUNT_ID))
        .isEqualTo("local-member");
    var browser = new MockHttpServletRequest("GET", "/api/v1/auth/dev/mobile");
    browser.addHeader("Origin", "https://example.test");
    assertThatThrownBy(() -> controller.mobile("admin", browser)).isInstanceOf(ApiException.class);
    assertThat(browser.getSession(false)).isNull();
  }
}
