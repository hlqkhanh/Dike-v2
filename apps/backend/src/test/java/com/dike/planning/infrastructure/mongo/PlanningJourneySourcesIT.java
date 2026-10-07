package com.dike.planning.infrastructure.mongo;

import static org.assertj.core.api.Assertions.*;

import com.dike.planning.domain.*;
import com.dike.shared.api.ApiException;
import com.dike.shared.application.AtomicCommands;
import com.mongodb.client.*;
import java.time.*;
import java.util.List;
import org.bson.Document;
import org.junit.jupiter.api.*;
import org.springframework.data.mongodb.MongoTransactionManager;
import org.springframework.data.mongodb.core.*;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.*;

@Testcontainers(disabledWithoutDocker = true)
class PlanningJourneySourcesIT {
  @Container static final MongoDBContainer MONGO = new MongoDBContainer("mongo:8.0.32-noble");
  static MongoClient client;
  static MongoTemplate mongo;
  PlanningJourneySources sources;
  AtomicCommands commands;
  static final Instant NOW = Instant.parse("2026-10-07T01:00:00Z");

  @BeforeAll
  static void connect() {
    client = MongoClients.create(MONGO.getReplicaSetUrl());
    mongo = new MongoTemplate(client, "post_sources_it");
  }

  @AfterAll
  static void close() {
    if (client != null) client.close();
  }

  @BeforeEach
  void setup() {
    mongo.getDb().drop();
    for (String c :
        List.of(
            "route_snapshots",
            "travel_intents",
            "post_source_routes",
            "command_guards",
            "command_receipts")) mongo.createCollection(c);
    Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
    sources = new PlanningJourneySources(mongo, clock);
    commands =
        new AtomicCommands(
            mongo, new MongoTransactionManager(mongo.getMongoDatabaseFactory()), clock);
    var a = new PlaceDocument("test", "a", "Private A", "Area A", 106.1, 10.1, NOW);
    var b = new PlaceDocument("test", "b", "Private B", "Area B", 106.2, 10.2, NOW);
    mongo.insert(
        new RouteSnapshotDocument(
            "r",
            "owner",
            "test",
            "r",
            VehicleMode.CAR,
            a,
            b,
            10000,
            1800,
            List.of(new RoutePoint(106.1, 10.1), new RoutePoint(106.2, 10.2)),
            NOW,
            NOW.plusSeconds(900),
            0));
  }

  @Test
  void sourceUsesServerRouteMetricsAndPublicLabels() {
    String id =
        commands.transaction(
            () -> sources.create("owner", "r", NOW.plusSeconds(3600), NOW.plusSeconds(6000)));
    var intent = sources.intent("owner", id).orElseThrow();
    assertThat(intent.originLabel()).isEqualTo("Area A");
    assertThat(intent.latestDepartureAt()).isEqualTo(NOW.plusSeconds(4200));
    assertThat(sources.intent("other", id)).isEmpty();
  }

  @Test
  void foreignRouteAndImpossibleTimeWindowAreRejected() {
    assertThatThrownBy(
            () ->
                commands.transaction(
                    () ->
                        sources.create("other", "r", NOW.plusSeconds(3600), NOW.plusSeconds(6000))))
        .isInstanceOf(ApiException.class);
    assertThatThrownBy(
            () ->
                commands.transaction(
                    () ->
                        sources.create("owner", "r", NOW.plusSeconds(3600), NOW.plusSeconds(4000))))
        .isInstanceOf(ApiException.class);
    assertThat(mongo.getCollection("travel_intents").countDocuments()).isZero();
  }

  @Test
  void staleManualEditCannotOverwritePublishedCommitment() {
    String id =
        commands.transaction(
            () -> sources.create("owner", "r", NOW.plusSeconds(3600), NOW.plusSeconds(6000)));
    var store = new MongoPlanningStore(mongo);
    var before = store.intent(id).orElseThrow();
    commands.transaction(
        () -> {
          sources.commitIntent("owner", id, 0, "PUBLISHED");
          return null;
        });
    assertThatThrownBy(() -> store.replaceIntent(before, before))
        .isInstanceOf(org.springframework.dao.OptimisticLockingFailureException.class);
    assertThat(mongo.findById(id, Document.class, "travel_intents").getString("commitmentState"))
        .isEqualTo("PUBLISHED");
  }

  @Test
  void bookingCommitmentCannotBeReleasedByClosingAPost() {
    String id =
        commands.transaction(
            () -> sources.create("owner", "r", NOW.plusSeconds(3600), NOW.plusSeconds(6000)));
    commands.transaction(
        () -> {
          sources.commitIntent("owner", id, 0, "PUBLISHED");
          sources.commitIntent("owner", id, 0, "BOOKED");
          sources.releaseIntent("owner", id);
          return null;
        });
    assertThat(mongo.findById(id, Document.class, "travel_intents").getString("commitmentState"))
        .isEqualTo("BOOKED");
  }
}
