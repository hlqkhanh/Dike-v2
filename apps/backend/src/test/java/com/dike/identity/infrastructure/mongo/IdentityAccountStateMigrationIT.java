package com.dike.identity.infrastructure.mongo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import java.util.List;
import org.bson.Document;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.SimpleMongoClientDatabaseFactory;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@Testcontainers(disabledWithoutDocker = true)
class IdentityAccountStateMigrationIT {

  @Container
  private static final MongoDBContainer MONGO =
      new MongoDBContainer(DockerImageName.parse("mongo:8.0.32-noble"));

  private static MongoClient client;
  private static MongoTemplate template;

  private final IdentityAccountStateMigration migration = new IdentityAccountStateMigration();

  @BeforeAll
  static void startMongo() {
    client = MongoClients.create(MONGO.getReplicaSetUrl());
    template =
        new MongoTemplate(
            new SimpleMongoClientDatabaseFactory(client, "dike_stage3_account_state_test"));
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
  void backfillsSafeDefaultsWithoutElevatingLegacyUsers() {
    template.insert(
        new Document("_id", "legacy-user")
            .append("phoneCandidateE164", "+84901234567")
            .append("phoneStatus", "UNVERIFIED"),
        "users");

    migration.apply(template);

    Document user = template.findById("legacy-user", Document.class, "users");
    assertThat(user).isNotNull();
    assertThat(user.getString("phoneE164")).isEqualTo("+84901234567");
    assertThat(user.containsKey("phoneCandidateE164")).isFalse();
    assertThat(user.getString("phoneStatus")).isEqualTo("UNVERIFIED");
    assertThat(user.getString("accountStatus")).isEqualTo("ACTIVE");
    assertThat(user.getString("onboardingStatus")).isEqualTo("PHONE_REQUIRED");
    assertThat(user.getString("verificationEvidence")).isEqualTo("NONE");
    assertThat(user.getLong("phoneVersion")).isZero();
    assertThat(user.getLong("authorizationVersion")).isZero();
    assertThat(user.getList("assignedRoles", String.class)).isEmpty();
  }

  @Test
  void enforcesUniquenessOnlyForVerifiedPhones() {
    migration.apply(template);

    template.insert(user("unverified-1", "UNVERIFIED"), "users");
    template.insert(user("unverified-2", "UNVERIFIED"), "users");
    template.insert(user("verified-1", "VERIFIED"), "users");

    assertThatThrownBy(() -> template.insert(user("verified-2", "VERIFIED"), "users"))
        .isInstanceOf(DuplicateKeyException.class);
  }

  @Test
  void refusesMigrationWhenVerifiedDuplicatesAlreadyExist() {
    template.insert(
        List.of(user("verified-1", "VERIFIED"), user("verified-2", "VERIFIED")), "users");

    assertThatThrownBy(() -> migration.apply(template))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("duplicate verified phones");
  }

  private Document user(String id, String status) {
    return new Document("_id", id)
        .append("phoneE164", "+84901234567")
        .append("phoneStatus", status);
  }
}
