package com.dike.identity.infrastructure.otp;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Component;

@Component
public final class OtpCodeProtector {

  private static final String ALGORITHM = "HmacSHA256";
  private final byte[] codeKey;
  private final byte[] rateKey;

  public OtpCodeProtector(OtpProperties properties) {
    this.codeKey = properties.hmacSecret().getBytes(StandardCharsets.UTF_8);
    this.rateKey = properties.rateKeySecret().getBytes(StandardCharsets.UTF_8);
  }

  public byte[] codeMac(
      String challengeId,
      String userId,
      long phoneVersion,
      String purpose,
      long generation,
      String code) {
    return mac(
        codeKey,
        String.join(
            "\u001f",
            challengeId,
            userId,
            Long.toString(phoneVersion),
            purpose,
            Long.toString(generation),
            code));
  }

  public boolean matches(
      byte[] expected,
      String challengeId,
      String userId,
      long phoneVersion,
      String purpose,
      long generation,
      String code) {
    return MessageDigest.isEqual(
        expected, codeMac(challengeId, userId, phoneVersion, purpose, generation, code));
  }

  public String phoneKey(String phoneE164) {
    return java.util.HexFormat.of().formatHex(mac(rateKey, phoneE164));
  }

  private byte[] mac(byte[] key, String value) {
    try {
      Mac mac = Mac.getInstance(ALGORITHM);
      mac.init(new SecretKeySpec(key, ALGORITHM));
      return mac.doFinal(value.getBytes(StandardCharsets.UTF_8));
    } catch (java.security.GeneralSecurityException exception) {
      throw new IllegalStateException("HMAC is unavailable", exception);
    }
  }
}
