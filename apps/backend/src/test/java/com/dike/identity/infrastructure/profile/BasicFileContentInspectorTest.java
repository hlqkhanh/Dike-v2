package com.dike.identity.infrastructure.profile;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.dike.identity.domain.FilePurpose;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.time.Duration;
import java.util.Base64;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;

class BasicFileContentInspectorTest {

  private final BasicFileContentInspector inspector =
      new BasicFileContentInspector(
          new ProfileProperties(
              new ProfileProperties.Documents(
                  "terms-v1",
                  URI.create("https://example.test/terms"),
                  "privacy-v1",
                  URI.create("https://example.test/privacy"),
                  "age-v1"),
              new ProfileProperties.Files(
                  Duration.ofMinutes(5),
                  Duration.ofMinutes(1),
                  Duration.ofHours(24),
                  URI.create("https://objects.example.test/"),
                  "basic",
                  5_242_880,
                  10_485_760,
                  1_000_000),
              new ProfileProperties.Deletion(Duration.ofDays(7), "v1")));

  @Test
  void avatarIsDecodedAndReencodedAsJpeg() throws Exception {
    BufferedImage image = new BufferedImage(2, 2, BufferedImage.TYPE_INT_ARGB);
    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
    ImageIO.write(image, "png", bytes);

    var result = inspector.inspect(FilePurpose.AVATAR, "image/png", bytes.toByteArray());

    assertThat(result.detectedContentType()).isEqualTo("image/jpeg");
    assertThat(result.safeContent()).startsWith((byte) 0xff, (byte) 0xd8);
  }

  @Test
  void rejectsActivePdfAndNonImageAvatar() {
    byte[] active = "%PDF-1.7\n/JavaScript".getBytes(java.nio.charset.StandardCharsets.US_ASCII);
    assertThatThrownBy(
            () -> inspector.inspect(FilePurpose.VERIFICATION_DOCUMENT, "application/pdf", active))
        .isInstanceOf(BasicFileContentInspector.UnsafeContentException.class);
    assertThatThrownBy(
            () -> inspector.inspect(FilePurpose.AVATAR, "text/plain", "hello".getBytes()))
        .isInstanceOf(BasicFileContentInspector.UnsafeContentException.class);
  }

  @Test
  void webpAvatarIsDecodedAndReencodedAsJpeg() {
    byte[] webp = Base64.getDecoder().decode("UklGRhoAAABXRUJQVlA4TA4AAAAvAAAAEAcQERGIiP4HAA==");

    var result = inspector.inspect(FilePurpose.AVATAR, "image/webp", webp);

    assertThat(result.detectedContentType()).isEqualTo("image/jpeg");
    assertThat(result.safeContent()).startsWith((byte) 0xff, (byte) 0xd8);
  }
}
