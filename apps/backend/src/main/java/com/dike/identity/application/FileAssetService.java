package com.dike.identity.application;

import com.dike.identity.domain.FileAsset;
import com.dike.identity.domain.FilePurpose;
import com.dike.identity.domain.FileState;
import com.dike.identity.domain.FileVisibility;
import com.dike.identity.infrastructure.profile.ProfileProperties;
import com.dike.shared.application.ObjectStorage;
import com.dike.shared.application.StorageLocations;
import com.dike.shared.outbox.OutboxPublisher;
import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Supplier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FileAssetService {

  public static final String PROCESS_EVENT = "identity.file.processing-requested";
  public static final String DELETE_EVENT = "identity.file.deletion-requested";
  private static final Set<String> AVATAR_TYPES = Set.of("image/jpeg", "image/png", "image/webp");
  private static final Set<String> DOCUMENT_TYPES =
      Set.of("image/jpeg", "image/png", "application/pdf");

  private final ProfileDataStore store;
  private final ObjectStorage storage;
  private final StorageLocations locations;
  private final ProfileProperties properties;
  private final OutboxPublisher events;
  private final Clock clock;
  private final Supplier<String> ids;

  public FileAssetService(
      ProfileDataStore store,
      ObjectStorage storage,
      StorageLocations locations,
      ProfileProperties properties,
      OutboxPublisher events,
      Clock clock,
      Supplier<String> ids) {
    this.store = store;
    this.storage = storage;
    this.locations = locations;
    this.properties = properties;
    this.events = events;
    this.clock = clock;
    this.ids = ids;
  }

  public UploadIntent createUpload(
      String userId,
      FilePurpose purpose,
      String contentType,
      long sizeBytes,
      String checksumSha256) {
    String type = contentType == null ? "" : contentType.toLowerCase(Locale.ROOT);
    validateUpload(purpose, type, sizeBytes);
    Instant now = clock.instant();
    Instant expires = now.plus(properties.files().uploadTtl());
    String id = ids.get();
    String key =
        locations.environment()
            + "/staging/"
            + purpose.name().toLowerCase(Locale.ROOT)
            + "/"
            + ids.get();
    FileAsset asset =
        new FileAsset(
            id,
            userId,
            purpose,
            purpose == FilePurpose.AVATAR ? FileVisibility.PUBLIC : FileVisibility.PRIVATE,
            FileState.PENDING_UPLOAD,
            key,
            null,
            type,
            null,
            sizeBytes,
            null,
            checksumSha256,
            null,
            null,
            expires,
            null,
            now,
            now,
            null,
            null,
            0);
    store.insertFile(asset);
    ObjectStorage.UploadGrant grant =
        storage.presignPut(
            locations.privateBucket(), key, type, properties.files().uploadTtl(), checksumSha256);
    return new UploadIntent(id, grant.url(), grant.requiredHeaders(), expires);
  }

  @Transactional
  public FileView complete(String userId, String fileId, String idempotencyKey) {
    requireIdempotencyKey(idempotencyKey);
    FileAsset asset = ownerFile(userId, fileId);
    if (asset.state() == FileState.PROCESSING || asset.state() == FileState.READY)
      return view(asset);
    if (asset.state() != FileState.PENDING_UPLOAD)
      throw new FileConflictException("FILE_UPLOAD_INCOMPLETE");
    if (asset.uploadExpiresAt().isBefore(clock.instant()))
      throw new FileConflictException("FILE_UPLOAD_EXPIRED");
    ObjectStorage.ObjectMetadata metadata;
    try {
      metadata = storage.head(locations.privateBucket(), asset.stagingLocator());
    } catch (RuntimeException exception) {
      throw new FileConflictException("FILE_UPLOAD_INCOMPLETE");
    }
    if (metadata.size() != asset.declaredSize()
        || metadata.size() > maximumBytes(asset.purpose())
        || (metadata.contentType() != null
            && !metadata.contentType().equalsIgnoreCase(asset.declaredContentType()))) {
      reject(asset, metadata, "METADATA_MISMATCH");
      throw new FileConflictException("FILE_CONTENT_INVALID");
    }
    Instant now = clock.instant();
    FileAsset uploaded =
        store
            .transitionFile(
                fileId,
                FileState.PENDING_UPLOAD,
                FileState.UPLOADED,
                now,
                new ProfileDataStore.FileAssetUpdate(
                    null, null, metadata.size(), metadata.etag(), null, null, null))
            .orElseThrow(() -> new FileConflictException("FILE_UPLOAD_INCOMPLETE"));
    FileAsset processing =
        store
            .transitionFile(
                fileId,
                FileState.UPLOADED,
                FileState.PROCESSING,
                now,
                ProfileDataStore.FileAssetUpdate.none())
            .orElseThrow(() -> new FileConflictException("FILE_UPLOAD_INCOMPLETE"));
    events.publish(PROCESS_EVENT, "FileAsset", fileId, 1, Map.of("fileId", fileId));
    return view(processing);
  }

  public FileView metadata(String userId, String fileId) {
    return view(ownerFile(userId, fileId));
  }

  public DownloadGrant download(String userId, String fileId) {
    FileAsset asset = ownerFile(userId, fileId);
    if (asset.purpose() != FilePurpose.VERIFICATION_DOCUMENT || asset.state() != FileState.READY) {
      throw new FileConflictException("FILE_PROCESSING");
    }
    URI url =
        storage.presignGet(
            locations.privateBucket(),
            asset.finalLocator(),
            properties.files().downloadTtl(),
            "verification-document");
    return new DownloadGrant(url, clock.instant().plus(properties.files().downloadTtl()));
  }

  @Transactional
  public void delete(String userId, String fileId, String idempotencyKey) {
    requireIdempotencyKey(idempotencyKey);
    FileAsset asset = ownerFile(userId, fileId);
    if (asset.state() == FileState.DELETED || asset.state() == FileState.DELETION_PENDING) return;
    if (asset.purpose() == FilePurpose.AVATAR) {
      store.clearAvatarIfMatches(userId, fileId, clock.instant());
    }
    FileAsset pending =
        store
            .transitionFile(
                asset.id(),
                asset.state(),
                FileState.DELETION_PENDING,
                clock.instant(),
                ProfileDataStore.FileAssetUpdate.none())
            .orElseThrow(() -> new FileConflictException("FILE_PROCESSING"));
    events.publish(DELETE_EVENT, "FileAsset", pending.id(), 1, Map.of("fileId", pending.id()));
  }

  private FileAsset ownerFile(String userId, String fileId) {
    return store
        .findFile(fileId)
        .filter(file -> file.ownerUserId().equals(userId))
        .orElseThrow(FileNotFoundException::new);
  }

  private void validateUpload(FilePurpose purpose, String contentType, long size) {
    Set<String> allowed = purpose == FilePurpose.AVATAR ? AVATAR_TYPES : DOCUMENT_TYPES;
    if (!allowed.contains(contentType)) throw new TypeNotAllowedException();
    if (size <= 0 || size > maximumBytes(purpose)) throw new FileTooLargeException();
  }

  private long maximumBytes(FilePurpose purpose) {
    return purpose == FilePurpose.AVATAR
        ? properties.files().avatarMaximumBytes()
        : properties.files().verificationMaximumBytes();
  }

  private void reject(FileAsset asset, ObjectStorage.ObjectMetadata metadata, String code) {
    store.transitionFile(
        asset.id(),
        asset.state(),
        FileState.REJECTED,
        clock.instant(),
        new ProfileDataStore.FileAssetUpdate(
            null, metadata.contentType(), metadata.size(), metadata.etag(), code, null, null));
  }

  private void requireIdempotencyKey(String key) {
    if (key == null || key.isBlank() || key.length() > 128)
      throw new InvalidIdempotencyKeyException();
  }

  private FileView view(FileAsset asset) {
    return new FileView(
        asset.id(),
        asset.purpose(),
        asset.state(),
        asset.declaredContentType(),
        asset.declaredSize(),
        asset.createdAt(),
        asset.updatedAt(),
        asset.readyAt());
  }

  public record UploadIntent(
      String fileId, URI uploadUrl, Map<String, String> requiredHeaders, Instant expiresAt) {}

  public record FileView(
      String fileId,
      FilePurpose purpose,
      FileState state,
      String contentType,
      long sizeBytes,
      Instant createdAt,
      Instant updatedAt,
      Instant readyAt) {}

  public record DownloadGrant(URI downloadUrl, Instant expiresAt) {}

  public static final class FileNotFoundException extends RuntimeException {}

  public static final class TypeNotAllowedException extends RuntimeException {}

  public static final class FileTooLargeException extends RuntimeException {}

  public static final class InvalidIdempotencyKeyException extends RuntimeException {}

  public static final class FileConflictException extends RuntimeException {
    private final String code;

    public FileConflictException(String code) {
      this.code = code;
    }

    public String code() {
      return code;
    }
  }
}
