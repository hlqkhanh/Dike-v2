package com.dike.shared.observability;

import java.util.regex.Pattern;

public final class SensitiveValueRedactor {

  private static final Pattern BEARER = Pattern.compile("(?i)(bearer\\s+)[a-z0-9._~+/=-]+");
  private static final Pattern SECRET_FIELD =
      Pattern.compile(
          "(?i)(\\\"?(?:password|secret|token|otp)\\\"?\\s*[:=]\\s*\\\"?)[^\\\",\\s}]+");
  private static final Pattern PHONE = Pattern.compile("(?<!\\d)(?:\\+?84|0)\\d{8,10}(?!\\d)");

  private SensitiveValueRedactor() {}

  public static String redact(String value) {
    if (value == null) {
      return null;
    }
    String redacted = BEARER.matcher(value).replaceAll("$1[REDACTED]");
    redacted = SECRET_FIELD.matcher(redacted).replaceAll("$1[REDACTED]");
    return PHONE.matcher(redacted).replaceAll("[REDACTED_PHONE]");
  }
}
