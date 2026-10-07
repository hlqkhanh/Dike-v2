package com.dike.identity.infrastructure.profile;

import com.dike.identity.application.FileAssetService;
import com.dike.identity.application.ProfileDataStore;
import com.dike.identity.domain.FileAsset;
import com.dike.identity.domain.FilePurpose;
import com.dike.identity.domain.FileState;
import com.dike.shared.application.ObjectStorage;
import com.dike.shared.application.StorageLocations;
import com.dike.shared.outbox.OutboxEvent;
import com.dike.shared.outbox.OutboxHandler;
import java.time.Clock;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("worker | combined")
class FileAssetDeletionHandler implements OutboxHandler {
  private final ProfileDataStore store;
  private final ObjectStorage storage;
  private final StorageLocations locations;
  private final Clock clock;

  FileAssetDeletionHandler(
      ProfileDataStore store, ObjectStorage storage, StorageLocations locations, Clock clock) {
    this.store = store;
    this.storage = storage;
    this.locations = locations;
    this.clock = clock;
  }

  @Override
  public String consumerName() {
    return "identity.file-asset-deletion.v1";
  }

  @Override
  public String eventType() {
    return FileAssetService.DELETE_EVENT;
  }

  @Override
  public int payloadVersion() {
    return 1;
  }

  @Override
  public void handle(OutboxEvent event) {
    FileAsset asset = store.findFile(String.valueOf(event.payload().get("fileId"))).orElseThrow();
    if (asset.state() == FileState.DELETED) return;
    if (asset.stagingLocator() != null)
      storage.delete(locations.privateBucket(), asset.stagingLocator());
    if (asset.finalLocator() != null) {
      String bucket =
          asset.purpose() == FilePurpose.AVATAR
              ? locations.publicBucket()
              : locations.privateBucket();
      storage.delete(bucket, asset.finalLocator());
    }
    store.transitionFile(
        asset.id(),
        FileState.DELETION_PENDING,
        FileState.DELETED,
        clock.instant(),
        new ProfileDataStore.FileAssetUpdate(null, null, null, null, null, null, clock.instant()));
  }
}
