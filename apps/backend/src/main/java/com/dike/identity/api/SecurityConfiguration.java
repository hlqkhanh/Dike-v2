package com.dike.identity.api;

import com.dike.identity.application.AuthService;
import com.dike.shared.api.ApiErrorWriter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.oauth2.client.CommonOAuth2Provider;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.registration.*;
import org.springframework.security.oauth2.client.web.*;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.NullSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextHolderFilter;
import org.springframework.session.data.redis.config.annotation.web.http.EnableRedisHttpSession;
import org.springframework.session.web.http.CookieSerializer;
import org.springframework.session.web.http.DefaultCookieSerializer;
import org.springframework.web.cors.CorsConfiguration;

@Configuration(proxyBeanMethods = false)
@ConditionalOnWebApplication
@EnableRedisHttpSession(maxInactiveIntervalInSeconds = 300, redisNamespace = "dike:oauth:v1")
public class SecurityConfiguration {
  @Bean
  org.springframework.security.core.userdetails.UserDetailsService noPasswordLogin() {
    return username -> {
      throw new org.springframework.security.core.userdetails.UsernameNotFoundException(
          "Password login is unavailable");
    };
  }

  @Bean
  CookieSerializer cookieSerializer(AuthSettings settings) {
    var serializer = new DefaultCookieSerializer();
    serializer.setCookieName("DIKE_OAUTH");
    serializer.setUseHttpOnlyCookie(true);
    serializer.setUseSecureCookie(settings.secure());
    serializer.setSameSite("Lax");
    serializer.setCookiePath("/");
    return serializer;
  }

  @Bean
  SecurityFilterChain authSecurity(
      HttpSecurity http,
      AuthSettings settings,
      AuthService auth,
      org.springframework.data.redis.core.StringRedisTemplate redis)
      throws Exception {
    http.csrf(csrf -> csrf.disable())
        .requestCache(cache -> cache.disable())
        .securityContext(
            context -> context.securityContextRepository(new NullSecurityContextRepository()))
        .logout(logout -> logout.disable())
        .cors(
            cors ->
                cors.configurationSource(
                    request -> {
                      var config = new CorsConfiguration();
                      config.setAllowedOrigins(List.of(settings.webUrl()));
                      config.setAllowCredentials(true);
                      config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
                      config.setAllowedHeaders(
                          List.of("Content-Type", "X-CSRF-TOKEN", "X-Request-ID"));
                      config.setExposedHeaders(List.of("X-Request-ID", "Retry-After"));
                      return config;
                    }))
        .authorizeHttpRequests(
            rules ->
                rules
                    .requestMatchers("/actuator/health/**", "/api/v1/auth/**")
                    .permitAll()
                    .requestMatchers("/api/openapi.json/**")
                    .access(
                        (authentication, context) ->
                            new org.springframework.security.authorization.AuthorizationDecision(
                                !settings.secure()))
                    .anyRequest()
                    .denyAll())
        .exceptionHandling(
            errors ->
                errors
                    .authenticationEntryPoint(
                        (request, response, e) ->
                            ApiErrorWriter.write(
                                request,
                                response,
                                HttpStatus.UNAUTHORIZED,
                                "SESSION_REQUIRED",
                                "Please sign in"))
                    .accessDeniedHandler(
                        (request, response, e) ->
                            ApiErrorWriter.write(
                                request,
                                response,
                                HttpStatus.FORBIDDEN,
                                "ACCESS_DENIED",
                                "Access denied")))
        .addFilterBefore(new AuthBoundaryFilter(settings, auth), SecurityContextHolderFilter.class);
    if (!settings.clientId().isBlank() && !settings.clientSecret().isBlank()) {
      ClientRegistration registration =
          CommonOAuth2Provider.GOOGLE
              .getBuilder("google")
              .clientId(settings.clientId())
              .clientSecret(settings.clientSecret())
              .redirectUri(settings.callbackUrl())
              .build();
      var registrations = new InMemoryClientRegistrationRepository(registration);
      var resolver = new DefaultOAuth2AuthorizationRequestResolver(registrations, "/api/v1/auth");
      resolver.setAuthorizationRequestCustomizer(OAuth2AuthorizationRequestCustomizers.withPkce());
      http.oauth2Login(
          oauth ->
              oauth
                  .clientRegistrationRepository(registrations)
                  .authorizedClientRepository(
                      new OAuth2AuthorizedClientRepository() {
                        public <T extends OAuth2AuthorizedClient> T loadAuthorizedClient(
                            String id, Authentication principal, HttpServletRequest request) {
                          return null;
                        }

                        public void saveAuthorizedClient(
                            OAuth2AuthorizedClient client,
                            Authentication principal,
                            HttpServletRequest request,
                            HttpServletResponse response) {}

                        public void removeAuthorizedClient(
                            String id,
                            Authentication principal,
                            HttpServletRequest request,
                            HttpServletResponse response) {}
                      })
                  .authorizationEndpoint(
                      endpoint ->
                          endpoint
                              .authorizationRequestResolver(resolver)
                              .authorizationRequestRepository(new OAuthRequestRepository(redis)))
                  .redirectionEndpoint(endpoint -> endpoint.baseUri("/api/v1/auth/callback"))
                  .successHandler(
                      (request, response, authentication) -> {
                        try {
                          OidcUser user = (OidcUser) authentication.getPrincipal();
                          var issued =
                              auth.login(
                                  user.getSubject(),
                                  user.getFullName() == null ? "Member" : user.getFullName(),
                                  user.getEmail());
                          if (request.getSession(false) != null)
                            request.getSession(false).invalidate();
                          AuthCookies.write(response, issued.credential(), settings.secure());
                          response.sendRedirect(settings.webUrl() + "/onboarding/phone");
                        } catch (RuntimeException e) {
                          if (request.getSession(false) != null)
                            request.getSession(false).invalidate();
                          response.sendRedirect(
                              settings.webUrl() + "/login?error=AUTH_UNAVAILABLE");
                        }
                      })
                  .failureHandler(
                      (request, response, e) -> {
                        if (request.getSession(false) != null)
                          request.getSession(false).invalidate();
                        response.sendRedirect(settings.webUrl() + "/login?error=OAUTH_FAILED");
                      }));
    }
    return http.build();
  }
}
