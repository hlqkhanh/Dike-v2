package com.dike.identity.infrastructure.profile;

import com.dike.identity.application.FileAssetService;
import com.dike.identity.application.FileContentInspector;
import com.dike.identity.application.ProfileDataStore;
import com.dike.identity.domain.FileAsset;
import com.dike.identity.domain.FilePurpose;
import com.dike.identity.domain.FileState;
import com.dike.shared.application.ObjectStorage;
import com.dike.shared.application.StorageLocations;
import com.dike.shared.outbox.OutboxEvent;
import com.dike.shared.outbox.OutboxHandler;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.time.Clock;
import java.util.Locale;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("worker | combined")
class FileAssetProcessingHandler implements OutboxHandler {

  private final ProfileDataStore store;
  private final ObjectStorage storage;
  private final FileContentInspector inspector;
  private final StorageLocations locations;
  private final ProfileProperties properties;
  private final Clock clock;

  FileAssetProcessingHandler(
      ProfileDataStore store,
      ObjectStorage storage,
      FileContentInspector inspector,
      StorageLocations locations,
      ProfileProperties properties,
      Clock clock) {
    this.store = store;
    this.storage = storage;
    this.inspector = inspector;
    this.locations = locations;
    this.properties = properties;
    this.clock = clock;
  }

  @Override
  public String eventType() {
    return FileAssetService.PROCESS_EVENT;
  }

  @Override
  public int payloadVersion() {
    return 1;
  }

  @Override
  public void handle(OutboxEvent event) {
    String fileId = String.valueOf(event.payload().get("fileId"));
    FileAsset asset = store.findFile(fileId).orElseThrow();
    if (asset.state() == FileState.READY) {
      attachReadyAvatar(asset);
      return;
    }
    if (asset.state() == FileState.REJECTED) return;
    if (asset.state() != FileState.PROCESSING)
      throw new IllegalStateException("Unexpected file state");
    try {
      byte[] original = readLimited(asset);
      FileContentInspector.Inspection inspection =
          inspector.inspect(asset.purpose(), asset.declaredContentType(), original);
      String finalKey =
          locations.environment()
              + "/ready/"
              + asset.purpose().name().toLowerCase(Locale.ROOT)
              + "/"
              + asset.id()
              + "."
              + inspection.outputExtension();
      String targetBucket =
          asset.purpose() == FilePurpose.AVATAR
              ? locations.publicBucket()
              : locations.privateBucket();
      storage.put(
          targetBucket,
          finalKey,
          new ByteArrayInputStream(inspection.safeContent()),
          inspection.safeContent().length,
          inspection.detectedContentType());
      var ready =
          store.transitionFile(
              asset.id(),
              FileState.PROCESSING,
              FileState.READY,
              clock.instant(),
              new ProfileDataStore.FileAssetUpdate(
                  finalKey,
                  inspection.detectedContentType(),
                  (long) original.length,
                  asset.etag(),
                  null,
                  clock.instant(),
                  null));
      if (ready.isPresent() && asset.purpose() == FilePurpose.AVATAR) {
        attachReadyAvatar(ready.orElseThrow());
      }
      storage.delete(locations.privateBucket(), asset.stagingLocator());
    } catch (BasicFileContentInspector.UnsafeContentException exception) {
      store.transitionFile(
          asset.id(),
          FileState.PROCESSING,
          FileState.REJECTED,
          clock.instant(),
          new ProfileDataStore.FileAssetUpdate(
              null, null, null, null, "UNSAFE_CONTENT", null, null));
      storage.delete(locations.privateBucket(), asset.stagingLocator());
    }
  }

  private void attachReadyAvatar(FileAsset asset) {
    if (asset.purpose() != FilePurpose.AVATAR || asset.finalLocator() == null) return;
    URI publicUrl = properties.files().publicBaseUrl().resolve(asset.finalLocator());
    store.attachAvatar(asset.ownerUserId(), asset.id(), publicUrl.toString(), clock.instant());
  }

  private byte[] readLimited(FileAsset asset) {
    long maximum =
        asset.purpose() == FilePurpose.AVATAR
            ? properties.files().avatarMaximumBytes()
            : properties.files().verificationMaximumBytes();
    try (InputStream input = storage.get(locations.privateBucket(), asset.stagingLocator())) {
      byte[] bytes = input.readNBytes(Math.toIntExact(maximum + 1));
      if (bytes.length > maximum) throw new BasicFileContentInspector.UnsafeContentException();
      return bytes;
    } catch (IOException exception) {
      throw new IllegalStateException("Cannot inspect stored file", exception);
    }
  }
}
