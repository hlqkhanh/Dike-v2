package com.dike.identity.infrastructure.mongo;

import static org.assertj.core.api.Assertions.assertThat;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import java.time.Instant;
import org.bson.Document;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.SimpleMongoClientDatabaseFactory;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@Testcontainers(disabledWithoutDocker = true)
class ProfileMigrationIT {
  @Container
  private static final MongoDBContainer MONGO =
      new MongoDBContainer(DockerImageName.parse("mongo:8.0.32-noble"));

  private static MongoClient client;
  private static MongoTemplate template;
  private final ProfileIndexesMigration migration = new ProfileIndexesMigration();
  private final LegacyProfileVisibilityMigration visibilityMigration =
      new LegacyProfileVisibilityMigration();

  @BeforeAll
  static void startMongo() {
    client = MongoClients.create(MONGO.getReplicaSetUrl());
    template = new MongoTemplate(new SimpleMongoClientDatabaseFactory(client, "dike_profile_test"));
  }

  @AfterAll
  static void stopMongo() {
    if (client != null) client.close();
  }

  @BeforeEach
  void cleanDatabase() {
    template.getDb().drop();
  }

  @Test
  void backfillsProfileAndSafePrivacyDefaultsIdempotently() {
    Instant now = Instant.parse("2026-10-06T00:00:00Z");
    template.insert(
        new Document("_id", "active-user")
            .append("displayName", " Nguyễn  An ")
            .append("avatarUrl", "https://provider.invalid/avatar")
            .append("accountStatus", "ACTIVE")
            .append("createdAt", now)
            .append("updatedAt", now),
        "users");
    template.insert(
        new Document("_id", "locked-user")
            .append("displayName", "Locked User")
            .append("accountStatus", "LOCKED")
            .append("createdAt", now)
            .append("updatedAt", now),
        "users");

    migration.apply(template);
    migration.apply(template);

    Document profile = template.findById("active-user", Document.class, "user_profiles");
    Document privacy = template.findById("active-user", Document.class, "user_privacy_settings");
    Document locked = template.findById("locked-user", Document.class, "user_privacy_settings");
    assertThat(profile.getString("normalizedDisplayName")).isEqualTo("nguyễn an");
    assertThat(profile.getString("avatarPublicUrl")).isEqualTo("https://provider.invalid/avatar");
    assertThat(profile.containsKey("avatarFileId")).isFalse();
    assertThat(privacy.getBoolean("discoverableByName")).isTrue();
    assertThat(locked.getString("profileVisibility")).isEqualTo("PRIVATE");
    assertThat(template.getCollection("user_profiles").countDocuments()).isEqualTo(2);
  }

  @Test
  void replacesRemovedPublicProfileVisibilityIdempotently() {
    template.insert(
        new Document("_id", "legacy-user").append("profileVisibility", "PUBLIC"),
        "user_privacy_settings");

    visibilityMigration.apply(template);
    visibilityMigration.apply(template);

    Document privacy = template.findById("legacy-user", Document.class, "user_privacy_settings");
    assertThat(privacy.getString("profileVisibility")).isEqualTo("MEMBERS");
  }
}
