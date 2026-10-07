package com.dike.community.infrastructure;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.dike.community.SocialAccounts;
import com.dike.community.application.SocialService;
import com.dike.community.domain.SocialRelation.Action;
import com.dike.shared.outbox.OutboxPublisher;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.bson.Document;
import org.junit.jupiter.api.*;
import org.springframework.data.mongodb.MongoTransactionManager;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.SimpleMongoClientDatabaseFactory;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
class MongoSocialStoreIT {
  @Container static final MongoDBContainer MONGO = new MongoDBContainer("mongo:8.0.32-noble");
  static MongoClient client;
  static MongoTemplate mongo;
  MongoSocialStore store;
  SocialService service;
  OutboxPublisher publisher;

  @BeforeAll
  static void connect() {
    client = MongoClients.create(MONGO.getReplicaSetUrl());
    mongo = new MongoTemplate(new SimpleMongoClientDatabaseFactory(client, "social_it"));
  }

  @AfterAll
  static void close() {
    if (client != null) client.close();
  }

  @BeforeEach
  void setup() {
    mongo.getDb().drop();
    new SocialIndexesMigration().apply(mongo);
    mongo.createCollection("outbox_events");
    mongo.createCollection("command_guards");
    publisher = mock(OutboxPublisher.class);
    // Writes through the same MongoTemplate/session, allowing rollback assertions.
    when(publisher.publish(anyString(), anyString(), anyString(), anyInt(), anyMap()))
        .thenAnswer(
            call -> {
              mongo.insert(
                  new Document("_id", UUID.randomUUID().toString())
                      .append("aggregateId", call.getArgument(2)),
                  "outbox_events");
              return null;
            });
    store =
        new MongoSocialStore(
            mongo, new MongoTransactionManager(mongo.getMongoDatabaseFactory()), publisher);
    SocialAccounts accounts = mock(SocialAccounts.class);
    when(accounts.active(anyString())).thenReturn(true);
    when(accounts.visibleName(anyString(), anyString())).thenReturn(Optional.of("Member"));
    service =
        new SocialService(
            store, accounts, Clock.fixed(Instant.parse("2026-10-07T00:00:00Z"), ZoneOffset.UTC));
  }

  private SocialService.RelationView send(String a, String b, String key) {
    return service.command(a, Action.SEND, b, null, key);
  }

  @Test
  void oppositeConcurrentInvitesDoNotAutoAcceptOrDuplicate() throws Exception {
    race(() -> send("a", "b", "send-key-a"), () -> send("b", "a", "send-key-b"));
    assertThat(mongo.getCollection("social_relations").countDocuments()).isEqualTo(1);
    assertThat(store.pair("a", "b").orElseThrow().friends()).isFalse();
    assertThat(mongo.getCollection("outbox_events").countDocuments()).isEqualTo(1);
  }

  @Test
  void acceptanceAndBlockRaceEndsBlocked() throws Exception {
    var invitation = send("a", "b", "send-key-a");
    race(
        () -> {
          try {
            service.command("b", Action.ACCEPT, null, invitation.requestId(), "accept-key");
          } catch (com.dike.shared.api.ApiException expectedConflict) {
            /* block committed first */
          }
        },
        () -> service.command("a", Action.BLOCK, "b", null, "block-key"));
    var result = store.pair("a", "b").orElseThrow();
    assertThat(result.blockedBy()).contains("a");
    assertThat(result.friends()).isFalse();
  }

  @Test
  void retryIsIdempotentAndReusingKeyForDifferentTargetFails() {
    var first = send("a", "b", "send-key-a");
    assertThat(send("a", "b", "send-key-a").requestId()).isEqualTo(first.requestId());
    assertThat(mongo.getCollection("outbox_events").countDocuments()).isEqualTo(1);
    assertThat(store.revision("a")).isEqualTo(1);
    assertThatThrownBy(() -> send("a", "c", "send-key-a"))
        .isInstanceOf(com.dike.shared.api.ApiException.class);
  }

  @Test
  void failedOutboxRollsBackRelationQuotaRevisionAndReceipt() {
    doThrow(new IllegalStateException("Injected outage"))
        .when(publisher)
        .publish(anyString(), anyString(), anyString(), anyInt(), anyMap());
    assertThatThrownBy(() -> send("a", "b", "send-key-a")).hasMessage("Injected outage");
    for (String collection :
        java.util.List.of(
            "social_relations",
            "social_receipts",
            "social_quotas",
            "social_revisions",
            "social_audit")) {
      assertThat(mongo.getCollection(collection).countDocuments()).as(collection).isZero();
    }
  }

  @Test
  void quotaAppliesAcrossTargetsButNeverPreventsBlocking() {
    for (int i = 0; i < 10; i++) send("a", "target" + i, "send-key-" + i);
    assertThatThrownBy(() -> send("a", "eleventh", "send-key-last"))
        .isInstanceOf(com.dike.shared.api.ApiException.class);
    assertThat(service.command("a", Action.BLOCK, "target0", null, "block-key").blockedByMe())
        .isTrue();
    assertThat(store.list("a", "outgoing", null, 50)).hasSize(9);
  }

  private void race(Runnable a, Runnable b) throws Exception {
    var gate = new CountDownLatch(1);
    try (var executor = Executors.newFixedThreadPool(2)) {
      var first =
          executor.submit(
              () -> {
                await(gate);
                a.run();
              });
      var second =
          executor.submit(
              () -> {
                await(gate);
                b.run();
              });
      gate.countDown();
      first.get(30, TimeUnit.SECONDS);
      second.get(30, TimeUnit.SECONDS);
    }
  }

  @Test
  void privacyRevisionReachesStrangersAndDeletionPurgesRelationships() {
    send("a", "b", "send-key-a");
    store.transaction(
        () -> {
          store.invalidateProfiles();
          return null;
        });
    assertThat(store.revision("stranger")).isEqualTo(1);
    store.transaction(
        () -> {
          store.purgeUser("a");
          return null;
        });
    assertThat(store.pair("a", "b")).isEmpty();
    assertThat(store.revision("b")).isGreaterThan(2);
    for (String collection :
        java.util.List.of("social_relations", "social_receipts", "social_audit"))
      assertThat(mongo.getCollection(collection).countDocuments()).as(collection).isZero();
  }

  private void await(CountDownLatch gate) {
    try {
      gate.await();
    } catch (InterruptedException error) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException(error);
    }
  }
}
