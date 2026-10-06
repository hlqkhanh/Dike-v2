package com.dike.identity.infrastructure.profile;

import com.dike.community.SocialAccountDeletion;
import com.dike.identity.application.AccountDeletionService;
import com.dike.identity.application.ProfileDataStore;
import com.dike.identity.domain.AccountDeletionRequest;
import com.dike.identity.domain.AccountDeletionState;
import com.dike.identity.domain.FileAsset;
import com.dike.identity.domain.FilePurpose;
import com.dike.shared.application.ObjectStorage;
import com.dike.shared.application.StorageLocations;
import com.dike.shared.outbox.OutboxEvent;
import com.dike.shared.outbox.OutboxHandler;
import java.time.Clock;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("worker | combined")
class AccountDeletionHandler implements OutboxHandler {

  private final ProfileDataStore store;
  private final ObjectStorage storage;
  private final StorageLocations locations;
  private final Clock clock;
  private final SocialAccountDeletion social;

  AccountDeletionHandler(
      ProfileDataStore store,
      ObjectStorage storage,
      StorageLocations locations,
      Clock clock,
      SocialAccountDeletion social) {
    this.store = store;
    this.storage = storage;
    this.locations = locations;
    this.clock = clock;
    this.social = social;
  }

  @Override
  public String eventType() {
    return AccountDeletionService.EVENT;
  }

  @Override
  public int payloadVersion() {
    return 1;
  }

  @Override
  public void handle(OutboxEvent event) {
    String requestId = String.valueOf(event.payload().get("requestId"));
    AccountDeletionRequest request = store.findDeletionById(requestId).orElseThrow();
    if (request.state() == AccountDeletionState.COMPLETED) return;
    if (request.executeAfter().isAfter(clock.instant()))
      throw new IllegalStateException("Deletion is not due");
    for (FileAsset file : store.findFilesByOwner(request.userId())) {
      if (file.stagingLocator() != null)
        storage.delete(locations.privateBucket(), file.stagingLocator());
      if (file.finalLocator() != null) {
        String bucket =
            file.purpose() == FilePurpose.AVATAR
                ? locations.publicBucket()
                : locations.privateBucket();
        storage.delete(bucket, file.finalLocator());
      }
    }
    social.purge(request.userId());
    store.purgeIdentityOwnedData(request.userId());
    store.completeDeletion(request.id(), request.userId(), clock.instant());
  }
}
