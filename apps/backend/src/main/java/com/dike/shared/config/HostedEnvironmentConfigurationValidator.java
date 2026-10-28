package com.dike.shared.config;

import java.net.URI;
import java.util.Arrays;
import java.util.List;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
public final class HostedEnvironmentConfigurationValidator implements ApplicationRunner {

  private static final List<String> LOCAL_HOSTS = List.of("localhost", "127.0.0.1", "minio");

  private final Environment environment;

  public HostedEnvironmentConfigurationValidator(Environment environment) {
    this.environment = environment;
  }

  @Override
  public void run(ApplicationArguments arguments) {
    String stage = value("dike.environment", "local");
    var profiles = Arrays.asList(environment.getActiveProfiles());
    if (profiles.contains("demo") && !"demo".equals(stage)) reject("dike.environment");
    if (profiles.contains("demo")
        && profiles.stream()
            .anyMatch(List.of("local", "staging", "production", "api", "worker")::contains)) {
      reject("spring.profiles.active");
    }
    if ("demo".equals(stage)) {
      if (!profiles.contains("demo")) reject("spring.profiles.active");
      validateDemo();
      return;
    }
    if (!"staging".equals(stage) && !"production".equals(stage)) {
      return;
    }

    requireOneOf("dike.workload", List.of("api", "worker"));
    requireNonDefault("dike.service.version", List.of("dev", "local", "unknown"));
    requireRemoteUri("spring.mongodb.uri", true);
    requireRemoteHost("spring.data.redis.host");
    requireValue("spring.data.redis.ssl.enabled", "true");
    requireSecureUri("dike.storage.endpoint");
    requireNonDefault("dike.storage.access-key", List.of("dike-local", "local-not-configured"));
    requireNonDefault("dike.storage.secret-key", List.of("dike-local-secret"));
    requireNonDefault("dike.ride.boarding-key", List.of());
    requireValue("dike.routing.provider", "goong");
    requireNonDefault("dike.routing.api-key", List.of("local-not-configured"));
    requireValue("dike.planning.contribution.demo", "false");
    requireSecureUri("dike.realtime.websocket-url");
    requireValue("dike.identity.simulated-full-access-enabled", "false");
  }

  private void validateDemo() {
    requireValue("dike.workload", "combined");
    requireNonDefault("dike.service.version", List.of("dev", "local", "unknown"));
    requireRemoteUri("spring.mongodb.uri", true);
    requireRemoteHost("spring.data.redis.host");
    // This demo only uses Render's private, same-region Redis network.
    requireValue("spring.data.redis.ssl.enabled", "false");
    if (!required("spring.data.redis.host").matches("red-[a-z0-9]+")) {
      reject("spring.data.redis.host");
    }
    requireValue("dike.identity.simulated-full-access-enabled", "false");
    requireValue("dike.auth.dev-login-enabled", "false");
    requireValue("dike.auth.require-phone-otp", "false");
    requireValue("dike.auth.cookie.secure", "true");
    requireValue("dike.auth.cookie.name", "__Host-DIKE_SESSION");
    requireValue("dike.otp.provider", "disabled");
    requireValue("dike.otp.send-enabled", "false");
    requireValue("dike.routing.provider", "disabled");
    requireSecureUri("dike.auth.public-base-url");
    if (!required("dike.auth.public-base-url").startsWith("https://"))
      reject("dike.auth.public-base-url");
    for (String raw : required("dike.auth.allowed-origins").split(",")) {
      URI origin = URI.create(raw.trim());
      if (!"https".equals(origin.getScheme())
          || origin.getHost() == null
          || !origin.getPath().isEmpty()
          || origin.getQuery() != null
          || origin.getFragment() != null) {
        reject("dike.auth.allowed-origins");
      }
    }
    requireNonDefault(
        "spring.security.oauth2.client.registration.google.client-id",
        List.of("local-not-configured"));
    requireNonDefault(
        "spring.security.oauth2.client.registration.google.client-secret",
        List.of("local-not-configured"));
    requireSecureUri("dike.realtime.websocket-url");
  }

  private void requireRemoteUri(String key, boolean allowMongoScheme) {
    String raw = required(key);
    URI uri = URI.create(raw);
    String scheme = uri.getScheme();
    boolean acceptedScheme =
        allowMongoScheme && ("mongodb".equals(scheme) || "mongodb+srv".equals(scheme));
    if (!acceptedScheme || uri.getHost() == null || LOCAL_HOSTS.contains(uri.getHost())) {
      reject(key);
    }
  }

  private void requireSecureUri(String key) {
    URI uri = URI.create(required(key));
    boolean secure = "https".equals(uri.getScheme()) || "wss".equals(uri.getScheme());
    if (!secure || uri.getHost() == null || LOCAL_HOSTS.contains(uri.getHost())) {
      reject(key);
    }
  }

  private void requireRemoteHost(String key) {
    String host = required(key);
    if (LOCAL_HOSTS.contains(host)) {
      reject(key);
    }
  }

  private void requireOneOf(String key, List<String> accepted) {
    if (!accepted.contains(required(key))) {
      reject(key);
    }
  }

  private void requireValue(String key, String expected) {
    if (!expected.equalsIgnoreCase(required(key))) {
      reject(key);
    }
  }

  private void requireNonDefault(String key, List<String> rejected) {
    String actual = required(key);
    if (rejected.stream().anyMatch(value -> value.equalsIgnoreCase(actual))) {
      reject(key);
    }
  }

  private String required(String key) {
    String actual = value(key, "");
    if (actual.isBlank()) {
      reject(key);
    }
    return actual;
  }

  private String value(String key, String fallback) {
    return environment.getProperty(key, fallback).trim();
  }

  private void reject(String key) {
    throw new IllegalStateException("Secure hosted configuration is required for property: " + key);
  }
}
