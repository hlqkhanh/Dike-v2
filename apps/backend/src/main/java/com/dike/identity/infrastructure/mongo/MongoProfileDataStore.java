package com.dike.identity.infrastructure.mongo;

import com.dike.identity.application.ProfileDataStore;
import com.dike.identity.domain.AccountDeletionRequest;
import com.dike.identity.domain.AccountDeletionState;
import com.dike.identity.domain.AccountStatus;
import com.dike.identity.domain.ConsentDecision;
import com.dike.identity.domain.ConsentReceipt;
import com.dike.identity.domain.ConsentType;
import com.dike.identity.domain.FileAsset;
import com.dike.identity.domain.FileState;
import com.dike.identity.domain.ProfileVisibility;
import com.dike.identity.domain.UserPrivacySettings;
import com.dike.identity.domain.UserProfile;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;

@Repository
class MongoProfileDataStore implements ProfileDataStore {

  private final MongoTemplate template;

  MongoProfileDataStore(MongoTemplate template) {
    this.template = template;
  }

  @Override
  public Optional<UserProfile> findProfile(String userId) {
    return Optional.ofNullable(template.findById(userId, UserProfileDocument.class)).map(this::map);
  }

  @Override
  public Optional<UserPrivacySettings> findPrivacy(String userId) {
    return Optional.ofNullable(template.findById(userId, UserPrivacyDocument.class)).map(this::map);
  }

  @Override
  public UserProfile saveInitialProfile(UserProfile profile) {
    try {
      return map(template.insert(map(profile)));
    } catch (DuplicateKeyException exception) {
      return findProfile(profile.userId()).orElseThrow(() -> exception);
    }
  }

  @Override
  public UserPrivacySettings saveInitialPrivacy(UserPrivacySettings settings) {
    try {
      return map(template.insert(map(settings)));
    } catch (DuplicateKeyException exception) {
      return findPrivacy(settings.userId()).orElseThrow(() -> exception);
    }
  }

  @Override
  public Optional<UserProfile> updateProfile(
      String userId,
      long expectedVersion,
      String displayName,
      String normalizedName,
      String bio,
      Instant now) {
    UserProfileDocument result =
        template.findAndModify(
            Query.query(Criteria.where("_id").is(userId).and("version").is(expectedVersion)),
            new Update()
                .set("displayName", displayName)
                .set("normalizedDisplayName", normalizedName)
                .set("bio", bio)
                .set("updatedAt", now)
                .inc("version", 1),
            FindAndModifyOptions.options().returnNew(true),
            UserProfileDocument.class);
    return Optional.ofNullable(result).map(this::map);
  }

  @Override
  public Optional<UserPrivacySettings> updatePrivacy(
      String userId,
      long expectedVersion,
      ProfileVisibility visibility,
      boolean discoverable,
      boolean allowMessages,
      Instant now) {
    UserPrivacyDocument result =
        template.findAndModify(
            Query.query(Criteria.where("_id").is(userId).and("version").is(expectedVersion)),
            new Update()
                .set("profileVisibility", visibility)
                .set("discoverableByName", discoverable)
                .set("allowMessageRequests", allowMessages)
                .set("updatedAt", now)
                .inc("version", 1),
            FindAndModifyOptions.options().returnNew(true),
            UserPrivacyDocument.class);
    return Optional.ofNullable(result).map(this::map);
  }

  @Override
  public List<UserProfile> searchProfiles(String prefix, String afterUserId, int limit) {
    Criteria criteria = Criteria.where("normalizedDisplayName").regex("^" + Pattern.quote(prefix));
    if (afterUserId != null && !afterUserId.isBlank())
      criteria = criteria.and("_id").gt(afterUserId);
    return template
        .find(
            Query.query(criteria).with(Sort.by("_id").ascending()).limit(limit),
            UserProfileDocument.class)
        .stream()
        .map(this::map)
        .toList();
  }

  @Override
  public ConsentReceipt insertConsent(ConsentReceipt receipt) {
    return map(template.insert(map(receipt)));
  }

  @Override
  public Optional<ConsentReceipt> findConsent(
      String userId, ConsentType type, String version, ConsentDecision decision) {
    Query query =
        Query.query(
            Criteria.where("userId")
                .is(userId)
                .and("consentType")
                .is(type)
                .and("documentVersion")
                .is(version)
                .and("decision")
                .is(decision));
    return Optional.ofNullable(template.findOne(query, ConsentReceiptDocument.class))
        .map(this::map);
  }

  @Override
  public List<ConsentReceipt> findConsents(String userId) {
    return template
        .find(
            Query.query(Criteria.where("userId").is(userId))
                .with(Sort.by("occurredAt").descending()),
            ConsentReceiptDocument.class)
        .stream()
        .map(this::map)
        .toList();
  }

  @Override
  public FileAsset insertFile(FileAsset asset) {
    return map(template.insert(map(asset)));
  }

  @Override
  public Optional<FileAsset> findFile(String fileId) {
    return Optional.ofNullable(template.findById(fileId, FileAssetDocument.class)).map(this::map);
  }

  @Override
  public Optional<FileAsset> transitionFile(
      String fileId, FileState expected, FileState target, Instant now, FileAssetUpdate change) {
    Update update = new Update().set("state", target).set("updatedAt", now).inc("version", 1);
    setIfPresent(update, "finalLocator", change.finalLocator());
    setIfPresent(update, "detectedContentType", change.detectedContentType());
    setIfPresent(update, "actualSize", change.actualSize());
    setIfPresent(update, "etag", change.etag());
    setIfPresent(update, "rejectionCode", change.rejectionCode());
    setIfPresent(update, "readyAt", change.readyAt());
    setIfPresent(update, "deletedAt", change.deletedAt());
    FileAssetDocument result =
        template.findAndModify(
            Query.query(Criteria.where("_id").is(fileId).and("state").is(expected)),
            update,
            FindAndModifyOptions.options().returnNew(true),
            FileAssetDocument.class);
    return Optional.ofNullable(result).map(this::map);
  }

  @Override
  public void attachAvatar(String userId, String fileId, String publicUrl, Instant now) {
    template.updateFirst(
        Query.query(Criteria.where("_id").is(userId)),
        new Update()
            .set("avatarFileId", fileId)
            .set("avatarPublicUrl", publicUrl)
            .set("updatedAt", now)
            .inc("version", 1),
        UserProfileDocument.class);
  }

  @Override
  public void clearAvatarIfMatches(String userId, String fileId, Instant now) {
    template.updateFirst(
        Query.query(Criteria.where("_id").is(userId).and("avatarFileId").is(fileId)),
        new Update()
            .unset("avatarFileId")
            .unset("avatarPublicUrl")
            .set("updatedAt", now)
            .inc("version", 1),
        UserProfileDocument.class);
  }

  @Override
  public List<FileAsset> findFilesForCleanup(Instant before, int limit) {
    return template
        .find(
            Query.query(
                    Criteria.where("state")
                        .in(FileState.PENDING_UPLOAD, FileState.UPLOADED, FileState.REJECTED)
                        .and("updatedAt")
                        .lt(before))
                .limit(limit),
            FileAssetDocument.class)
        .stream()
        .map(this::map)
        .toList();
  }

  @Override
  public List<FileAsset> findFilesByOwner(String userId) {
    return template
        .find(Query.query(Criteria.where("ownerUserId").is(userId)), FileAssetDocument.class)
        .stream()
        .map(this::map)
        .toList();
  }

  @Override
  public Optional<AccountDeletionRequest> findActiveDeletion(String userId) {
    return Optional.ofNullable(
            template.findOne(
                Query.query(
                    Criteria.where("userId")
                        .is(userId)
                        .and("state")
                        .in(AccountDeletionState.REQUESTED, AccountDeletionState.PROCESSING)),
                AccountDeletionDocument.class))
        .map(this::map);
  }

  @Override
  public AccountDeletionRequest insertDeletion(AccountDeletionRequest request) {
    return map(template.insert(map(request)));
  }

  @Override
  public Optional<AccountDeletionRequest> findDeletionById(String requestId) {
    return Optional.ofNullable(template.findById(requestId, AccountDeletionDocument.class))
        .map(this::map);
  }

  @Override
  public void markAccountDeletionRequested(String userId, Instant now) {
    template.updateFirst(
        Query.query(Criteria.where("_id").is(userId).and("accountStatus").is(AccountStatus.ACTIVE)),
        new Update()
            .set("accountStatus", AccountStatus.DELETION_REQUESTED)
            .set("updatedAt", now)
            .inc("authorizationVersion", 1),
        UserDocument.class);
  }

  @Override
  public void completeDeletion(String requestId, String userId, Instant now) {
    template.updateFirst(
        Query.query(Criteria.where("_id").is(requestId).and("userId").is(userId)),
        new Update()
            .set("state", AccountDeletionState.COMPLETED)
            .set("completedAt", now)
            .inc("version", 1),
        AccountDeletionDocument.class);
  }

  @Override
  public void purgeIdentityOwnedData(String userId) {
    template.remove(Query.query(Criteria.where("_id").is(userId)), UserProfileDocument.class);
    template.remove(Query.query(Criteria.where("_id").is(userId)), UserPrivacyDocument.class);
    template.remove(Query.query(Criteria.where("userId").is(userId)), ConsentReceiptDocument.class);
    template.remove(Query.query(Criteria.where("ownerUserId").is(userId)), FileAssetDocument.class);
    template.remove(Query.query(Criteria.where("userId").is(userId)), AuthIdentityDocument.class);
    template.remove(Query.query(Criteria.where("_id").is(userId)), UserDocument.class);
  }

  private void setIfPresent(Update update, String name, Object value) {
    if (value != null) update.set(name, value);
  }

  private UserProfile map(UserProfileDocument d) {
    return new UserProfile(
        d.userId(),
        d.displayName(),
        d.normalizedDisplayName(),
        d.bio(),
        d.avatarFileId(),
        d.avatarPublicUrl(),
        d.createdAt(),
        d.updatedAt(),
        d.version());
  }

  private UserProfileDocument map(UserProfile d) {
    return new UserProfileDocument(
        d.userId(),
        d.displayName(),
        d.normalizedDisplayName(),
        d.bio(),
        d.avatarFileId(),
        d.avatarPublicUrl(),
        d.createdAt(),
        d.updatedAt(),
        d.version());
  }

  private UserPrivacySettings map(UserPrivacyDocument d) {
    return new UserPrivacySettings(
        d.userId(),
        d.profileVisibility(),
        d.discoverableByName(),
        d.allowMessageRequests(),
        d.updatedAt(),
        d.version());
  }

  private UserPrivacyDocument map(UserPrivacySettings d) {
    return new UserPrivacyDocument(
        d.userId(),
        d.profileVisibility(),
        d.discoverableByName(),
        d.allowMessageRequests(),
        d.updatedAt(),
        d.version());
  }

  private ConsentReceipt map(ConsentReceiptDocument d) {
    return new ConsentReceipt(
        d.id(),
        d.userId(),
        d.consentType(),
        d.documentVersion(),
        d.decision(),
        d.occurredAt(),
        d.source(),
        d.locale(),
        d.correlationId(),
        d.supersedesReceiptId());
  }

  private ConsentReceiptDocument map(ConsentReceipt d) {
    return new ConsentReceiptDocument(
        d.id(),
        d.userId(),
        d.consentType(),
        d.documentVersion(),
        d.decision(),
        d.occurredAt(),
        d.source(),
        d.locale(),
        d.correlationId(),
        d.supersedesReceiptId());
  }

  private FileAsset map(FileAssetDocument d) {
    return new FileAsset(
        d.id(),
        d.ownerUserId(),
        d.purpose(),
        d.visibility(),
        d.state(),
        d.stagingLocator(),
        d.finalLocator(),
        d.declaredContentType(),
        d.detectedContentType(),
        d.declaredSize(),
        d.actualSize(),
        d.checksumSha256(),
        d.etag(),
        d.rejectionCode(),
        d.uploadExpiresAt(),
        d.retentionUntil(),
        d.createdAt(),
        d.updatedAt(),
        d.readyAt(),
        d.deletedAt(),
        d.version());
  }

  private FileAssetDocument map(FileAsset d) {
    return new FileAssetDocument(
        d.id(),
        d.ownerUserId(),
        d.purpose(),
        d.visibility(),
        d.state(),
        d.stagingLocator(),
        d.finalLocator(),
        d.declaredContentType(),
        d.detectedContentType(),
        d.declaredSize(),
        d.actualSize(),
        d.checksumSha256(),
        d.etag(),
        d.rejectionCode(),
        d.uploadExpiresAt(),
        d.retentionUntil(),
        d.createdAt(),
        d.updatedAt(),
        d.readyAt(),
        d.deletedAt(),
        d.version());
  }

  private AccountDeletionRequest map(AccountDeletionDocument d) {
    return new AccountDeletionRequest(
        d.id(),
        d.userId(),
        d.state(),
        d.requestedAt(),
        d.executeAfter(),
        d.completedAt(),
        d.policyVersion(),
        d.attempts(),
        d.lastFailureCategory(),
        d.version());
  }

  private AccountDeletionDocument map(AccountDeletionRequest d) {
    return new AccountDeletionDocument(
        d.id(),
        d.userId(),
        d.state(),
        d.requestedAt(),
        d.executeAfter(),
        d.completedAt(),
        d.policyVersion(),
        d.attempts(),
        d.lastFailureCategory(),
        d.version());
  }
}
