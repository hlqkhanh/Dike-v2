package com.dike.identity.infrastructure.security;

import com.dike.identity.application.AccountAccessService;
import com.dike.identity.application.AuthTelemetry;
import com.dike.identity.application.IdentityProvisioningService;
import com.dike.identity.application.LoginRateLimiter;
import com.dike.identity.infrastructure.otp.OtpProperties;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Clock;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizedClientRepository;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.NullSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.Session;
import org.springframework.session.web.http.CookieSerializer;
import org.springframework.session.web.http.DefaultCookieSerializer;

@Configuration(proxyBeanMethods = false)
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
@EnableConfigurationProperties(IdentityProperties.class)
@EnableMethodSecurity
public class SecurityConfiguration {

  @Bean
  SecurityContextRepository securityContextRepository() {
    return new NullSecurityContextRepository();
  }

  @Bean
  CookieSerializer cookieSerializer(IdentityProperties properties) {
    DefaultCookieSerializer serializer = new DefaultCookieSerializer();
    serializer.setCookieName(properties.cookie().name());
    serializer.setCookiePath("/");
    serializer.setUseHttpOnlyCookie(true);
    serializer.setUseSecureCookie(properties.cookie().secure());
    serializer.setSameSite(properties.cookie().sameSite());
    serializer.setCookieMaxAge((int) properties.session().absoluteLifetime().toSeconds());
    return serializer;
  }

  @Bean
  CookieCsrfTokenRepository csrfTokenRepository(IdentityProperties properties) {
    CookieCsrfTokenRepository csrf = CookieCsrfTokenRepository.withHttpOnlyFalse();
    csrf.setCookiePath("/");
    csrf.setCookieCustomizer(cookie -> cookie.secure(properties.cookie().secure()).sameSite("Lax"));
    return csrf;
  }

  @Bean
  SecurityFilterChain apiSecurity(
      HttpSecurity http,
      ClientRegistrationRepository clients,
      IdentityProvisioningService provisioning,
      AccountAccessService access,
      IdentityProperties properties,
      OAuth2AuthorizedClientRepository authorizedClients,
      SecurityContextRepository securityContexts,
      CookieCsrfTokenRepository csrf,
      FindByIndexNameSessionRepository<? extends Session> sessions,
      Clock clock,
      AuthTelemetry telemetry,
      LoginRateLimiter loginRateLimiter)
      throws Exception {
    var authorizationResolver =
        new PkceAuthorizationRequestResolver(
            clients, properties.publicBaseUrl(), properties.google().registrationId());

    var success =
        new OidcLoginSuccessHandler(
            provisioning, access, properties, authorizedClients, clock, sessions, telemetry);

    http.authorizeHttpRequests(
            requests ->
                requests
                    .requestMatchers(
                        "/actuator/health/**",
                        "/api/openapi.json",
                        "/api/v1/auth/google",
                        "/api/v1/auth/dev",
                        "/api/v1/auth/oauth2/authorization/**",
                        "/api/v1/auth/callback/**",
                        "/oauth2/**",
                        "/ws/**")
                    .permitAll()
                    .requestMatchers("/api/v1/auth/**")
                    .authenticated()
                    .requestMatchers(
                        "/api/v1/friendships/**", "/api/v1/blocks/**", "/api/v1/social/**")
                    .authenticated()
                    .requestMatchers(
                        "/api/v1/me/**", "/api/v1/users/**", "/api/v1/users", "/api/v1/files/**")
                    .authenticated()
                    .requestMatchers(
                        "/api/v1/demo/**",
                        "/api/v1/ride-posts/**",
                        "/api/v1/ride-post-responses/**",
                        "/api/v1/ride-post-sources/**",
                        "/api/v1/saved-posts/**",
                        "/api/v1/trips/**",
                        "/api/v1/proposals/**",
                        "/api/v1/bookings/**",
                        "/api/v1/ride-capabilities",
                        "/api/v1/reports",
                        "/api/v1/realtime/**",
                        "/api/v1/conversations/**",
                        "/api/v1/message-requests/**",
                        "/api/v1/notifications/**",
                        "/api/v1/availability/**",
                        "/api/v1/reviews/**",
                        "/api/v1/admin/**",
                        "/api/v1/routing/**",
                        "/api/v1/schedules/**",
                        "/api/v1/travel-intents/**")
                    .authenticated()
                    .requestMatchers("/api/**")
                    .denyAll()
                    .anyRequest()
                    .permitAll())
        .csrf(
            csrfConfig ->
                csrfConfig
                    .csrfTokenRepository(csrf)
                    .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()))
        .oauth2Login(
            oauth ->
                oauth
                    .authorizationEndpoint(
                        endpoint -> endpoint.authorizationRequestResolver(authorizationResolver))
                    .redirectionEndpoint(endpoint -> endpoint.baseUri("/api/v1/auth/callback/*"))
                    .userInfoEndpoint(
                        userInfo -> userInfo.oidcUserService(new OidcClaimsService(properties)))
                    .successHandler(success)
                    .failureHandler(
                        (request, response, exception) -> {
                          if (!loginRateLimiter.tryAcquireFailure(request.getRemoteAddr())) {
                            telemetry.login("rate_limited");
                            response.sendRedirect(
                                properties
                                    .publicBaseUrl()
                                    .resolve("/login?error=AUTH_RATE_LIMITED")
                                    .toString());
                            return;
                          }
                          String code =
                              exception instanceof OAuth2AuthenticationException oauthException
                                      && "OIDC_CLAIM_INVALID"
                                          .equals(oauthException.getError().getErrorCode())
                                  ? "OIDC_CLAIM_INVALID"
                                  : "OIDC_LOGIN_FAILED";
                          telemetry.login(code.toLowerCase(java.util.Locale.ROOT));
                          response.sendRedirect(
                              properties
                                  .publicBaseUrl()
                                  .resolve("/login?error=" + code)
                                  .toString());
                        }))
        .securityContext(context -> context.securityContextRepository(securityContexts))
        .requestCache(cache -> cache.disable())
        .logout(logout -> logout.disable())
        .exceptionHandling(
            exceptions ->
                exceptions
                    .authenticationEntryPoint(
                        (request, response, exception) ->
                            SecurityErrorWriter.write(
                                request,
                                response,
                                HttpServletResponse.SC_UNAUTHORIZED,
                                "AUTHENTICATION_REQUIRED",
                                "Bạn cần đăng nhập"))
                    .accessDeniedHandler(
                        (request, response, exception) ->
                            SecurityErrorWriter.write(
                                request,
                                response,
                                HttpServletResponse.SC_FORBIDDEN,
                                "CSRF_INVALID",
                                "Yêu cầu bảo mật không hợp lệ")))
        .headers(Customizer.withDefaults());

    http.addFilterBefore(new TrustedOriginFilter(properties), CsrfFilter.class);
    http.addFilterAfter(
        new AccountAuthenticationFilter(access),
        org.springframework.security.web.context.SecurityContextHolderFilter.class);
    http.addFilterAfter(new LockedAccountSafetyFilter(), AccountAuthenticationFilter.class);
    http.addFilterAfter(
        new AbsoluteSessionExpiryFilter(clock, properties, provisioning, telemetry),
        LockedAccountSafetyFilter.class);
    http.addFilterAfter(new AuthNoStoreFilter(), AbsoluteSessionExpiryFilter.class);
    return http.build();
  }

  @Bean
  org.springframework.boot.ApplicationRunner validateAuthProductionConfiguration(
      IdentityProperties properties, OtpProperties otp, Environment environment) {
    return arguments -> {
      String current = environment.getProperty("dike.environment", "local");
      String clientId =
          environment.getProperty(
              "spring.security.oauth2.client.registration.google.client-id", "");
      String clientSecret =
          environment.getProperty(
              "spring.security.oauth2.client.registration.google.client-secret", "");
      boolean securePublicUrl = "https".equalsIgnoreCase(properties.publicBaseUrl().getScheme());
      boolean secureOrigins =
          properties.allowedOrigins().stream()
              .allMatch(
                  origin ->
                      "https".equalsIgnoreCase(origin.getScheme())
                          && origin.getHost() != null
                          && origin.getPath().isEmpty()
                          && origin.getQuery() == null
                          && origin.getFragment() == null);
      boolean simulatedFullAccess =
          environment.getProperty(
              "dike.identity.simulated-full-access-enabled", Boolean.class, false);
      boolean devLogin =
          environment.getProperty("dike.auth.dev-login-enabled", Boolean.class, false);
      if (("production".equals(current) || "staging".equals(current))
          && (!properties.requirePhoneOtp()
              || !properties.cookie().secure()
              || !properties.cookie().name().startsWith("__Host-")
              || !securePublicUrl
              || !secureOrigins
              || clientId.isBlank()
              || clientSecret.isBlank()
              || clientId.startsWith("local-")
              || clientSecret.startsWith("local-")
              || "fake".equalsIgnoreCase(otp.provider())
              || otp.hmacSecret().startsWith("local-only-")
              || otp.rateKeySecret().startsWith("local-only-")
              || !otp.sendEnabled()
              || simulatedFullAccess
              || devLogin)) {
        throw new IllegalStateException("Secure auth configuration is required outside local/test");
      }
    };
  }
}
