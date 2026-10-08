package com.dike.shared.config;

import java.net.URI;
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
