package com.dike.identity.application;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

import com.dike.identity.domain.FilePurpose;
import com.dike.identity.infrastructure.profile.ProfileProperties;
import com.dike.shared.application.ObjectStorage;
import com.dike.shared.application.StorageLocations;
import com.dike.shared.outbox.OutboxPublisher;
import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import org.junit.jupiter.api.Test;

class FileAssetServiceTest {

  private final FileAssetService service =
      new FileAssetService(
          mock(ProfileDataStore.class),
          mock(ObjectStorage.class),
          new StorageLocations("test", "public", "private"),
          new ProfileProperties(
              new ProfileProperties.Documents(
                  "v1",
                  URI.create("https://example.test/terms"),
                  "v1",
                  URI.create("https://example.test/privacy"),
                  "v1"),
              new ProfileProperties.Files(
                  Duration.ofMinutes(5),
                  Duration.ofMinutes(1),
                  Duration.ofHours(24),
                  URI.create("https://objects.example.test/"),
                  "basic",
                  100,
                  200,
                  1_000),
              new ProfileProperties.Deletion(Duration.ofDays(7), "v1")),
          mock(OutboxPublisher.class),
          Clock.systemUTC(),
          () -> "id");

  @Test
  void rejectsUnsupportedAndOversizedUploadsBeforeStorageCall() {
    assertThatThrownBy(
            () -> service.createUpload("user", FilePurpose.AVATAR, "image/svg+xml", 10, null))
        .isInstanceOf(FileAssetService.TypeNotAllowedException.class);
    assertThatThrownBy(
            () -> service.createUpload("user", FilePurpose.AVATAR, "image/png", 101, null))
        .isInstanceOf(FileAssetService.FileTooLargeException.class);
  }
}
