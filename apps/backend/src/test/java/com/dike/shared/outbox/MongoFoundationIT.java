package com.dike.shared.outbox;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import org.bson.Document;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.MongoTransactionManager;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.SimpleMongoClientDatabaseFactory;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.utility.DockerImageName;

class MongoFoundationIT {

  private static final Instant NOW = Instant.parse("2026-01-01T00:00:00Z");
  private static final MongoDBContainer MONGO =
      new MongoDBContainer(DockerImageName.parse("mongo:8.0.32-noble"));
  private static MongoClient client;
  private static MongoTemplate template;
  private static TransactionTemplate transactions;

  @BeforeAll
  static void startMongo() {
    MONGO.start();
    client = MongoClients.create(MONGO.getReplicaSetUrl());
    var factory = new SimpleMongoClientDatabaseFactory(client, "dike_stage1_test");
    template = new MongoTemplate(factory);
    transactions = new TransactionTemplate(new MongoTransactionManager(factory));
  }

  @AfterAll
  static void stopMongo() {
    if (client != null) client.close();
    MONGO.stop();
  }

  @BeforeEach
  void cleanDatabase() {
    template.getDb().drop();
    template
        .indexOps("outbox_events")
        .ensureIndex(new Index().on("eventId", Sort.Direction.ASC).unique());
    template
        .indexOps("processed_events")
        .ensureIndex(new Index().on("eventId", Sort.Direction.ASC).unique());
  }

  @Test
  void commitsAndRollsBackMultipleDocumentsOnReplicaSet() {
    assertThat(MONGO.getReplicaSetUrl()).contains("replicaSet=");

    transactions.executeWithoutResult(
        ignored -> {
          template.insert(new Document("_id", "a"), "transaction_probe");
          template.insert(new Document("_id", "b"), "transaction_probe");
        });
    assertThat(template.getCollection("transaction_probe").countDocuments()).isEqualTo(2);

    assertThatThrownBy(
            () ->
                transactions.executeWithoutResult(
                    ignored -> {
                      template.insert(new Document("_id", "c"), "transaction_probe");
                      template.insert(new Document("_id", "d"), "transaction_probe");
                      throw new IllegalStateException("rollback probe");
                    }))
        .isInstanceOf(IllegalStateException.class);
    assertThat(template.getCollection("transaction_probe").countDocuments()).isEqualTo(2);
  }

  @Test
  void uniqueIndexAndConditionalWriteAreEnforced() {
    template
        .indexOps("constraint_probe")
        .ensureIndex(new Index().on("key", Sort.Direction.ASC).unique());
    template.insert(new Document("key", "same").append("version", 0), "constraint_probe");

    assertThatThrownBy(
            () ->
                template.insert(
                    new Document("key", "same").append("version", 0), "constraint_probe"))
        .isInstanceOf(DuplicateKeyException.class);

    var result =
        template.updateFirst(
            Query.query(Criteria.where("key").is("same").and("version").is(0)),
            new Update().inc("version", 1),
            "constraint_probe");
    var stale =
        template.updateFirst(
            Query.query(Criteria.where("key").is("same").and("version").is(0)),
            new Update().inc("version", 1),
            "constraint_probe");

    assertThat(result.getModifiedCount()).isEqualTo(1);
    assertThat(stale.getModifiedCount()).isZero();
  }

  @Test
  void outboxWriteIsAtomicAndOnlyOneWorkerClaimsBeforeLeaseExpires() throws Exception {
    Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
    OutboxPublisher publisher = new OutboxPublisher(template, clock, () -> "event-1");

    assertThatThrownBy(
            () ->
                transactions.executeWithoutResult(
                    ignored -> {
                      template.insert(new Document("_id", "state-1"), "state_probe");
                      publisher.publish(
                          "foundation.projection", "Probe", "state-1", 1, Map.of("ok", true));
                      throw new IllegalStateException("rollback both");
                    }))
        .isInstanceOf(IllegalStateException.class);
    assertThat(template.getCollection("state_probe").countDocuments()).isZero();
    assertThat(template.getCollection("outbox_events").countDocuments()).isZero();

    publisher.publish("foundation.projection", "Probe", "state-1", 1, Map.of("ok", true));
    OutboxStore store = new OutboxStore(template);
    CountDownLatch start = new CountDownLatch(1);
    try (var workers = Executors.newFixedThreadPool(2)) {
      var first =
          workers.submit(
              () -> {
                start.await();
                return store.claim("worker-a", NOW, NOW.plusSeconds(10));
              });
      var second =
          workers.submit(
              () -> {
                start.await();
                return store.claim("worker-b", NOW, NOW.plusSeconds(10));
              });
      start.countDown();
      assertThat(java.util.stream.Stream.of(first.get(), second.get()).filter(Objects::nonNull))
          .hasSize(1);
    }

    OutboxEvent blocked = store.claim("worker-c", NOW.plusSeconds(5), NOW.plusSeconds(15));
    OutboxEvent reclaimed = store.claim("worker-b", NOW.plusSeconds(11), NOW.plusSeconds(21));

    assertThat(blocked).isNull();
    assertThat(reclaimed.lockedBy()).isEqualTo("worker-b");
    assertThat(reclaimed.attempts()).isEqualTo(2);
  }

  @Test
  void sampleHandlerIsIdempotent() {
    FoundationProjectionHandler handler =
        new FoundationProjectionHandler(template, Clock.fixed(NOW, ZoneOffset.UTC));
    OutboxEvent event = event("event-idempotent");

    handler.handle(event);
    handler.handle(event);

    assertThat(template.getCollection("processed_events").countDocuments()).isEqualTo(1);
  }

  private OutboxEvent event(String id) {
    return new OutboxEvent(
        id,
        "foundation.projection",
        "Probe",
        "probe-1",
        1,
        Map.of(),
        "correlation-1",
        "causation-1",
        OutboxStatus.PROCESSING,
        1,
        NOW,
        NOW.plusSeconds(30),
        "worker-a",
        NOW,
        null,
        null);
  }
}
