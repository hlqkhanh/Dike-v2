package com.dike.identity.api;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

class AuthSettingsTest {
  private AuthSettings settings(String web, String callback) {
    return new AuthSettings(web, callback, "local", "", "", false);
  }

  @Test
  void normalizesTrailingSlashAndNeverPrintsCredentials() {
    var settings =
        new AuthSettings(
            "https://app.example.invalid/",
            "https://api.example.invalid/api/v1/auth/callback",
            "production",
            "client-id",
            "test-secret",
            true);
    assertEquals("https://app.example.invalid", settings.webUrl());
    assertFalse(settings.toString().contains("test-secret"));
    assertFalse(settings.toString().contains("client-id"));
  }

  @Test
  void rejectsInvalidOriginsCallbacksAndPartialCredentials() {
    String callback = "http://localhost:8080/api/v1/auth/callback";
    for (String origin :
        new String[] {
          "ftp://localhost",
          "https://user@app.example.invalid",
          "https://app.example.invalid/path",
          "https://app.example.invalid?x=1",
          "https://app.example.invalid:70000"
        }) assertThrows(IllegalArgumentException.class, () -> settings(origin, callback));
    for (String value :
        new String[] {
          "https:/api/v1/auth/callback",
          callback + "?x=1",
          callback + "#fragment",
          "http://user@localhost:8080/api/v1/auth/callback"
        })
      assertThrows(IllegalArgumentException.class, () -> settings("http://localhost:3000", value));
    assertThrows(
        IllegalArgumentException.class,
        () -> new AuthSettings("http://localhost:3000", callback, "local", "client", "", false));
  }
}
