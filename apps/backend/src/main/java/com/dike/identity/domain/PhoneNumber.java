package com.dike.identity.domain;

public final class PhoneNumber {
  private PhoneNumber() {}

  public static String normalize(String input) {
    if (input == null || input.length() > 32) throw new IllegalArgumentException("PHONE_INVALID");
    String value = input.replaceAll("[ ()-]", "");
    if (value.startsWith("0")) value = "+84" + value.substring(1);
    if (!value.matches("\\+84[35789][0-9]{8}")) throw new IllegalArgumentException("PHONE_INVALID");
    return value;
  }
}
