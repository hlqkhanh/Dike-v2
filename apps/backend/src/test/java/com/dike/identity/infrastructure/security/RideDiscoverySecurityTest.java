package com.dike.identity.infrastructure.security;

import static org.mockito.Mockito.mock;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.dike.identity.application.*;
import java.net.URI;
import java.time.*;
import java.util.List;
import org.junit.jupiter.api.*;
import org.springframework.context.annotation.*;
import org.springframework.mock.web.MockServletContext;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.oauth2.client.registration.*;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizedClientRepository;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.NullSecurityContextRepository;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

class RideDiscoverySecurityTest {
  static AnnotationConfigWebApplicationContext context;
  static MockMvc mvc;

  @BeforeAll
  static void start() {
    context = new AnnotationConfigWebApplicationContext();
    context.setServletContext(new MockServletContext());
    context.register(TestConfig.class);
    context.refresh();
    mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
  }

  @AfterAll
  static void close() {
    if (context != null) context.close();
  }

  @Test
  void authenticatedRequestWithCsrfReachesDiscovery() throws Exception {
    mvc.perform(
            post("/api/v1/ride-discovery")
                .header("Origin", "http://localhost:3000")
                .with(user("member"))
                .with(csrf()))
        .andExpect(status().isOk())
        .andExpect(content().string("ok"));
  }

  @Test
  void guestStillRequiresAuthentication() throws Exception {
    mvc.perform(
            post("/api/v1/ride-discovery").header("Origin", "http://localhost:3000").with(csrf()))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.error.code").value("AUTHENTICATION_REQUIRED"));
  }

  @Test
  void missingCsrfStillFailsWithReadableVietnamese() throws Exception {
    mvc.perform(
            post("/api/v1/ride-discovery")
                .header("Origin", "http://localhost:3000")
                .with(user("member")))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.error.code").value("CSRF_INVALID"))
        .andExpect(content().encoding("UTF-8"))
        .andExpect(jsonPath("$.error.message").value("Yêu cầu bảo mật không hợp lệ"));
  }

  @Test
  void unlistedApiRemainsDeniedAndDoesNotPretendToBeCsrfFailure() throws Exception {
    mvc.perform(
            post("/api/v1/not-an-approved-api")
                .header("Origin", "http://localhost:3000")
                .with(user("member"))
                .with(csrf()))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.error.code").value("ACCESS_DENIED"))
        .andExpect(jsonPath("$.error.message").value("Bạn không có quyền thực hiện yêu cầu này"));
  }

  @Configuration
  @EnableWebSecurity
  @EnableWebMvc
  static class TestConfig {
    @Bean
    ProbeController controller() {
      return new ProbeController();
    }

    @Bean
    ClientRegistrationRepository clients() {
      return new InMemoryClientRegistrationRepository(
          ClientRegistration.withRegistrationId("google")
              .clientId("test")
              .clientSecret("test")
              .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
              .redirectUri("http://localhost:8080/api/v1/auth/callback/google")
              .authorizationUri("https://example.test/authorize")
              .tokenUri("https://example.test/token")
              .userInfoUri("https://example.test/userinfo")
              .userNameAttributeName("sub")
              .build());
    }

    @Bean
    @SuppressWarnings("unchecked")
    SecurityFilterChain chain(HttpSecurity http, ClientRegistrationRepository clients)
        throws Exception {
      var props =
          new IdentityProperties(
              URI.create("http://localhost:8080"),
              List.of(URI.create("http://localhost:3000")),
              false,
              new IdentityProperties.Session(
                  Duration.ofHours(24), Duration.ofDays(30), Duration.ofMinutes(5), 10),
              new IdentityProperties.Cookie("DIKE_SESSION", false, "Lax"),
              new IdentityProperties.Google("https://accounts.google.com", "google"));
      var authorized = mock(OAuth2AuthorizedClientRepository.class);
      http.setSharedObject(ClientRegistrationRepository.class, clients);
      http.setSharedObject(OAuth2AuthorizedClientRepository.class, authorized);
      var config = new SecurityConfiguration();
      return config.apiSecurity(
          http,
          clients,
          mock(IdentityProvisioningService.class),
          mock(AccountAccessService.class),
          props,
          authorized,
          new NullSecurityContextRepository(),
          config.csrfTokenRepository(props),
          mock(FindByIndexNameSessionRepository.class),
          Clock.systemUTC(),
          mock(AuthTelemetry.class),
          mock(LoginRateLimiter.class),
          new org.springframework.mock.env.MockEnvironment());
    }
  }

  @RestController
  static class ProbeController {
    @PostMapping("/api/v1/ride-discovery")
    String discover() {
      return "ok";
    }
  }
}
