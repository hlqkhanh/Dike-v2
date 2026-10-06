package com.dike.identity.api;

import com.dike.identity.domain.ConsentDecision;
import com.dike.identity.domain.ConsentType;
import com.dike.identity.domain.ProfileVisibility;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class ProfileRequests {
  private ProfileRequests() {}

  public record UpdateProfile(
      @NotBlank @Size(max = 160) String displayName,
      @Size(max = 1200) String bio,
      @Min(0) long expectedVersion) {}

  public record UpdatePrivacy(
      @NotNull ProfileVisibility profileVisibility,
      boolean discoverableByName,
      boolean allowMessageRequests,
      @Min(0) long expectedVersion) {}

  public record ConsentDecisionRequest(
      @NotNull ConsentType consentType,
      @NotNull ConsentDecision decision,
      @Size(max = 32) String locale) {}
}
