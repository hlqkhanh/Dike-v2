package com.dike.identity.api;

import com.dike.identity.domain.FilePurpose;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public final class FileRequests {
  private FileRequests() {}

  public record CreateUpload(
      @NotNull FilePurpose purpose,
      @NotBlank String contentType,
      @Min(1) long sizeBytes,
      @Pattern(regexp = "^[A-Fa-f0-9]{64}$") String checksumSha256) {}
}
