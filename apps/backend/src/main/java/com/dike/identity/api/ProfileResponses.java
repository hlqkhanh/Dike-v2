package com.dike.identity.api;

import com.dike.identity.application.ConsentService;
import com.dike.identity.application.ProfileService;
import com.dike.identity.domain.AccountDeletionRequest;
import com.dike.identity.domain.ConsentReceipt;
import com.dike.identity.domain.UserAccount;
import com.dike.identity.domain.UserPrivacySettings;
import com.dike.identity.domain.UserProfile;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class ProfileResponses {
  private ProfileResponses() {}

  public record MyProfileResponse(
      String userId,
      String displayName,
      String bio,
      LocalDate dateOfBirth,
      String provinceCode,
      String provinceName,
      String localityCode,
      String localityName,
      String facebookUrl,
      String contactPhone,
      String contactEmail,
      String avatarUrl,
      long version,
      Instant updatedAt) {
    static MyProfileResponse from(UserProfile profile, UserAccount account) {
      return new MyProfileResponse(
          profile.userId(),
          profile.displayName(),
          profile.bio(),
          profile.dateOfBirth(),
          profile.provinceCode(),
          profile.provinceName(),
          profile.localityCode(),
          profile.localityName(),
          profile.facebookUrl(),
          account.phoneE164(),
          account.canonicalEmail(),
          profile.avatarPublicUrl(),
          profile.version(),
          profile.updatedAt());
    }
  }

  public record PrivacyResponse(
      String profileVisibility,
      boolean discoverableByName,
      boolean allowMessageRequests,
      long version,
      Instant updatedAt) {
    static PrivacyResponse from(UserPrivacySettings settings) {
      return new PrivacyResponse(
          settings.profileVisibility().name(),
          settings.discoverableByName(),
          settings.allowMessageRequests(),
          settings.version(),
          settings.updatedAt());
    }
  }

  public record PublicProfileResponse(
      String userId, String displayName, String bio, String avatarUrl, boolean verified) {
    static PublicProfileResponse from(ProfileService.PublicProfile profile) {
      return new PublicProfileResponse(
          profile.userId(),
          profile.displayName(),
          profile.bio(),
          profile.avatarUrl(),
          profile.verified());
    }
  }

  public record ProfileSearchResponse(List<PublicProfileResponse> items, String nextCursor) {
    public ProfileSearchResponse {
      items = List.copyOf(items);
    }
  }

  public record ConsentRequirementResponse(
      String type, String version, String documentUrl, boolean accepted) {
    static ConsentRequirementResponse from(ConsentService.Requirement requirement) {
      return new ConsentRequirementResponse(
          requirement.type().name(),
          requirement.version(),
          requirement.documentUrl(),
          requirement.accepted());
    }
  }

  public record ConsentReceiptResponse(
      String id,
      String type,
      String version,
      String decision,
      Instant occurredAt,
      String source,
      String locale) {
    static ConsentReceiptResponse from(ConsentReceipt receipt) {
      return new ConsentReceiptResponse(
          receipt.id(),
          receipt.consentType().name(),
          receipt.documentVersion(),
          receipt.decision().name(),
          receipt.occurredAt(),
          receipt.source(),
          receipt.locale());
    }
  }

  public record ConsentSummaryResponse(
      List<ConsentRequirementResponse> requirements, List<ConsentReceiptResponse> receipts) {
    public ConsentSummaryResponse {
      requirements = List.copyOf(requirements);
      receipts = List.copyOf(receipts);
    }
  }

  public record DeletionResponse(
      String requestId,
      String state,
      Instant requestedAt,
      Instant executeAfter,
      Instant completedAt) {
    static DeletionResponse from(AccountDeletionRequest request) {
      return request == null
          ? null
          : new DeletionResponse(
              request.id(),
              request.state().name(),
              request.requestedAt(),
              request.executeAfter(),
              request.completedAt());
    }
  }
}
