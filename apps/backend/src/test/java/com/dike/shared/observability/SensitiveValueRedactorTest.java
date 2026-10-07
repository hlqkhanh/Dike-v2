package com.dike.shared.observability;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class SensitiveValueRedactorTest {

  @Test
  void redactsBoardingCodesAndCiphertext() {
    assertThat(
            SensitiveValueRedactor.redact(
                "code=123456 boardingCode=654321 ciphertext=encryptedvalue"))
        .doesNotContain("123456", "654321", "encryptedvalue");
  }

  @Test
  void redactsBearerSecretsOtpAndVietnamesePhoneNumbers() {
    String raw = "Authorization=Bearer abc.def.ghi otp=123456 phone=0912345678 password=hunter2";

    String redacted = SensitiveValueRedactor.redact(raw);

    assertThat(redacted)
        .doesNotContain("abc.def.ghi", "123456", "0912345678", "hunter2")
        .contains("[REDACTED]", "[REDACTED_PHONE]");
  }

  @Test
  void redactsSignedObjectStorageCredentials() {
    String raw =
        "https://objects.example.test/private/file?X-Amz-Credential=credential&X-Amz-Signature=abcdef";

    String redacted = SensitiveValueRedactor.redact(raw);

    assertThat(redacted)
        .doesNotContain("credential", "abcdef")
        .contains("X-Amz-Credential=[REDACTED]", "X-Amz-Signature=[REDACTED]");
  }
}
