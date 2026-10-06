package com.dike.identity.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class ProfileServiceTest {

  @Test
  void normalizesUnicodeWhitespaceForSearch() {
    assertThat(ProfileService.normalizeName("  Nguyễn   Văn A  ")).isEqualTo("nguyễn văn a");
  }

  @Test
  void rejectsBidiOverrideAndOversizedBio() {
    assertThatThrownBy(() -> ProfileService.validateDisplayName("An\u202Ename"))
        .isInstanceOf(ProfileService.InvalidProfileException.class);
    assertThatThrownBy(() -> ProfileService.validateBio("a".repeat(301)))
        .isInstanceOf(ProfileService.InvalidProfileException.class);
  }

  @Test
  void normalizesBioLineEndingsWithoutRenderingMarkup() {
    assertThat(ProfileService.validateBio(" Xin chào\r\n<script> "))
        .isEqualTo("Xin chào\n<script>");
  }
}
