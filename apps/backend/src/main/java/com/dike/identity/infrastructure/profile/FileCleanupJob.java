package com.dike.identity.infrastructure.profile;

import com.dike.identity.application.ProfileDataStore;
import com.dike.identity.domain.FileAsset;
import com.dike.identity.domain.FileState;
import com.dike.shared.application.ObjectStorage;
import com.dike.shared.application.StorageLocations;
import java.time.Clock;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@Profile("worker | combined")
class FileCleanupJob {
  private final ProfileDataStore store;
  private final ObjectStorage storage;
  private final StorageLocations locations;
  private final ProfileProperties properties;
  private final Clock clock;

  FileCleanupJob(
      ProfileDataStore store,
      ObjectStorage storage,
      StorageLocations locations,
      ProfileProperties properties,
      Clock clock) {
    this.store = store;
    this.storage = storage;
    this.locations = locations;
    this.properties = properties;
    this.clock = clock;
  }

  @Scheduled(fixedDelayString = "${dike.profile.files.cleanup-interval:1h}")
  void cleanup() {
    for (FileAsset file :
        store.findFilesForCleanup(clock.instant().minus(properties.files().cleanupAge()), 100)) {
      if (file.stagingLocator() != null)
        storage.delete(locations.privateBucket(), file.stagingLocator());
      store.transitionFile(
          file.id(),
          file.state(),
          FileState.DELETED,
          clock.instant(),
          new ProfileDataStore.FileAssetUpdate(
              null, null, null, null, null, null, clock.instant()));
    }
  }
}
