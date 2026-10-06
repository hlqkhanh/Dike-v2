package com.dike.identity.infrastructure.profile;

import com.dike.identity.application.FileContentInspector;
import com.dike.identity.domain.FilePurpose;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import javax.imageio.ImageIO;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(
    prefix = "dike.profile.files",
    name = "inspector",
    havingValue = "basic",
    matchIfMissing = true)
class BasicFileContentInspector implements FileContentInspector {

  private final ProfileProperties properties;

  BasicFileContentInspector(ProfileProperties properties) {
    this.properties = properties;
  }

  @Override
  public Inspection inspect(FilePurpose purpose, String declaredContentType, byte[] content) {
    if (isPdf(content)) {
      if (purpose != FilePurpose.VERIFICATION_DOCUMENT || containsActivePdfContent(content)) {
        throw new UnsafeContentException();
      }
      return new Inspection("application/pdf", content, "pdf");
    }
    BufferedImage source;
    try {
      source = ImageIO.read(new ByteArrayInputStream(content));
    } catch (IOException exception) {
      throw new UnsafeContentException();
    }
    if (source == null || source.getWidth() <= 0 || source.getHeight() <= 0)
      throw new UnsafeContentException();
    long pixels = (long) source.getWidth() * source.getHeight();
    if (pixels > properties.files().maximumImagePixels()) throw new UnsafeContentException();
    if (purpose == FilePurpose.VERIFICATION_DOCUMENT) {
      return new Inspection(detectImageType(content), content, extension(content));
    }
    BufferedImage safe =
        new BufferedImage(source.getWidth(), source.getHeight(), BufferedImage.TYPE_INT_RGB);
    Graphics2D graphics = safe.createGraphics();
    graphics.drawImage(source, 0, 0, null);
    graphics.dispose();
    try {
      ByteArrayOutputStream output = new ByteArrayOutputStream();
      if (!ImageIO.write(safe, "jpg", output)) throw new UnsafeContentException();
      return new Inspection("image/jpeg", output.toByteArray(), "jpg");
    } catch (IOException exception) {
      throw new UnsafeContentException();
    }
  }

  private boolean isPdf(byte[] content) {
    return content.length >= 5
        && content[0] == '%'
        && content[1] == 'P'
        && content[2] == 'D'
        && content[3] == 'F'
        && content[4] == '-';
  }

  private boolean containsActivePdfContent(byte[] content) {
    String text = new String(content, StandardCharsets.ISO_8859_1);
    return text.contains("/JavaScript")
        || text.contains("/JS")
        || text.contains("/Launch")
        || text.contains("/EmbeddedFile");
  }

  private String detectImageType(byte[] content) {
    if (content.length >= 8
        && content[0] == (byte) 0x89
        && content[1] == 'P'
        && content[2] == 'N'
        && content[3] == 'G') return "image/png";
    if (content.length >= 3
        && content[0] == (byte) 0xff
        && content[1] == (byte) 0xd8
        && content[2] == (byte) 0xff) return "image/jpeg";
    throw new UnsafeContentException();
  }

  private String extension(byte[] content) {
    return "image/png".equals(detectImageType(content)) ? "png" : "jpg";
  }

  static final class UnsafeContentException extends RuntimeException {}
}
