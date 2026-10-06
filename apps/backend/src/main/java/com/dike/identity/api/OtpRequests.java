package com.dike.identity.api;

import com.dike.identity.domain.OtpPurpose;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public final class OtpRequests {

  private OtpRequests() {}

  public record Issue(@NotNull OtpPurpose purpose, long phoneVersion) {}

  public record Verify(@NotBlank @Pattern(regexp = "[0-9]{6}") String code) {}
}
