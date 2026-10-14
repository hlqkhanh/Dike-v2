package com.dike.identity.application;

import com.dike.identity.domain.AccountDeletionRequest;
import com.dike.identity.domain.ConsentDecision;
import com.dike.identity.domain.ConsentReceipt;
import com.dike.identity.domain.ConsentType;
import com.dike.identity.domain.FileAsset;
import com.dike.identity.domain.FileState;
import com.dike.identity.domain.UserPrivacySettings;
import com.dike.identity.domain.UserProfile;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ProfileDataStore {

  Optional<UserProfile> findProfile(String userId);

  Optional<UserPrivacySettings> findPrivacy(String userId);

  UserProfile saveInitialProfile(UserProfile profile);

  UserPrivacySettings saveInitialPrivacy(UserPrivacySettings settings);

  Optional<UserProfile> updateProfile(
      String userId,
      long expectedVersion,
      String displayName,
      String normalizedName,
      String bio,
      LocalDate dateOfBirth,
      String provinceCode,
      String provinceName,
      String localityCode,
      String localityName,
      String facebookUrl,
      Instant now);

  Optional<UserPrivacySettings> updatePrivacy(
      String userId,
      long expectedVersion,
      com.dike.identity.domain.ProfileVisibility visibility,
      boolean discoverable,
      boolean allowMessages,
      Instant now);

  List<UserProfile> searchProfiles(String normalizedPrefix, String afterUserId, int limit);

  ConsentReceipt insertConsent(ConsentReceipt receipt);

  Optional<ConsentReceipt> findConsent(
      String userId, ConsentType type, String documentVersion, ConsentDecision decision);

  List<ConsentReceipt> findConsents(String userId);

  FileAsset insertFile(FileAsset asset);

  Optional<FileAsset> findFile(String fileId);

  Optional<FileAsset> transitionFile(
      String fileId, FileState expected, FileState target, Instant now, FileAssetUpdate update);

  void attachAvatar(String userId, String fileId, String publicUrl, Instant now);

  void clearAvatarIfMatches(String userId, String fileId, Instant now);

  List<FileAsset> findFilesForCleanup(Instant before, int limit);

  List<FileAsset> findFilesByOwner(String userId);

  Optional<AccountDeletionRequest> findActiveDeletion(String userId);

  AccountDeletionRequest insertDeletion(AccountDeletionRequest request);

  Optional<AccountDeletionRequest> findDeletionById(String requestId);

  void markAccountDeletionRequested(String userId, Instant now);

  void completeDeletion(String requestId, String userId, Instant now);

  void purgeIdentityOwnedData(String userId);

  record FileAssetUpdate(
      String finalLocator,
      String detectedContentType,
      Long actualSize,
      String etag,
      String rejectionCode,
      Instant readyAt,
      Instant deletedAt) {
    public static FileAssetUpdate none() {
      return new FileAssetUpdate(null, null, null, null, null, null, null);
    }
  }
}
