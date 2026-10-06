package com.dike.identity.infrastructure.security;

import com.dike.identity.application.AuthTelemetry;
import com.dike.identity.application.IdentityProvisioningService;
import com.dike.identity.application.LoginRateLimiter;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Clock;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizedClientRepository;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
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
public class SecurityConfiguration {

  @Bean
  SecurityContextRepository securityContextRepository() {
    return new HttpSessionSecurityContextRepository();
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
            provisioning,
            properties,
            securityContexts,
            authorizedClients,
            clock,
            sessions,
            telemetry);

    http.authorizeHttpRequests(
            requests ->
                requests
                    .requestMatchers(
                        "/actuator/health/**",
                        "/api/openapi.json",
                        "/api/v1/auth/google",
                        "/api/v1/auth/oauth2/authorization/**",
                        "/api/v1/auth/callback/**",
                        "/oauth2/**")
                    .permitAll()
                    .requestMatchers("/api/v1/auth/**")
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
        new AbsoluteSessionExpiryFilter(clock, properties, provisioning, telemetry),
        org.springframework.security.web.context.SecurityContextHolderFilter.class);
    http.addFilterAfter(new AuthNoStoreFilter(), AbsoluteSessionExpiryFilter.class);
    return http.build();
  }

  @Bean
  org.springframework.boot.ApplicationRunner validateAuthProductionConfiguration(
      IdentityProperties properties, Environment environment) {
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
      if (("production".equals(current) || "staging".equals(current))
          && (!properties.requirePhoneOtp()
              || !properties.cookie().secure()
              || !properties.cookie().name().startsWith("__Host-")
              || !securePublicUrl
              || !secureOrigins
              || clientId.isBlank()
              || clientSecret.isBlank()
              || clientId.startsWith("local-")
              || clientSecret.startsWith("local-"))) {
        throw new IllegalStateException("Secure auth configuration is required outside local/test");
      }
    };
  }
}
