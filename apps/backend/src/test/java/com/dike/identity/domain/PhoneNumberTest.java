package com.dike.identity.domain;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

class PhoneNumberTest {
  @Test
  void normalizesMobileNumbers() {
    assertEquals("+84912345678", PhoneNumber.normalize("0912 345 678"));
    assertEquals("+84912345678", PhoneNumber.normalize("+84 912-345-678"));
  }

  @Test
  void rejectsMalformedAndForeignNumbers() {
    for (String value : new String[] {"", "+12025550123", "09123456789", "abc", "+840912345678"}) {
      assertThrows(IllegalArgumentException.class, () -> PhoneNumber.normalize(value));
    }
  }
}
