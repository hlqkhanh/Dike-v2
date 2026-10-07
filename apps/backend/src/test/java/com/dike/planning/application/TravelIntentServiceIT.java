package com.dike.planning.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.dike.identity.IdentityAccess;
import com.dike.planning.domain.PlaceSnapshot;
import com.dike.planning.domain.ScheduleDirection;
import com.dike.planning.domain.TravelIntent;
import com.dike.planning.domain.TravelRole;
import com.dike.planning.infrastructure.mongo.MongoPlanningStore;
import com.dike.planning.infrastructure.mongo.PlanningIndexesMigration;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
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
class TravelIntentServiceIT {

  @Container
  private static final MongoDBContainer MONGO =
      new MongoDBContainer(DockerImageName.parse("mongo:8.0.32-noble"));

  private static MongoClient client;
  private static MongoTemplate mongo;
  private TravelIntentService service;

  private IdentityAccess accounts;
  private ResolvedPlaceStore places;
  private Clock clock;

  @BeforeAll
  static void connect() {
    client = MongoClients.create(MONGO.getReplicaSetUrl());
    mongo =
        new MongoTemplate(
            new SimpleMongoClientDatabaseFactory(client, "dike_planning_service_test"));
  }

  @AfterAll
  static void close() {
    if (client != null) client.close();
  }

  @BeforeEach
  void reset() {
    mongo.getDb().drop();
    new PlanningIndexesMigration().apply(mongo);
    MongoPlanningStore store = new MongoPlanningStore(mongo);

    accounts = mock(IdentityAccess.class);
    places = mock(ResolvedPlaceStore.class);
    clock = Clock.fixed(Instant.parse("2026-10-07T00:00:00Z"), ZoneId.of("UTC"));

    service = new TravelIntentService(store, places, accounts, clock);

    when(accounts.require("test-user"))
        .thenReturn(new IdentityAccess.Access("test-user", true, true, false, null, 0L));
    when(places.find(any(), any()))
        .thenReturn(
            Optional.of(
                new PlaceSnapshot(
                    "GOONG",
                    "test-place",
                    "Test Place",
                    "Test Area",
                    106.7,
                    10.77,
                    Instant.now())));
  }

  @Test
  void concurrentManualIntentCreationShouldNotDuplicate() throws InterruptedException {
    String owner = "test-user";
    String idempotencyKey = "idempotent-key-123456";
    TravelIntentService.CreateManual command =
        new TravelIntentService.CreateManual(
            LocalDate.parse("2026-10-15"),
            ScheduleDirection.OUTBOUND,
            TravelRole.RIDER,
            "place-1",
            "place-2",
            null,
            Instant.parse("2026-10-15T08:00:00Z"));

    int threadCount = 10;
    ExecutorService executor = Executors.newFixedThreadPool(threadCount);
    CountDownLatch latch = new CountDownLatch(1);
    CountDownLatch done = new CountDownLatch(threadCount);

    AtomicInteger successCount = new AtomicInteger(0);
    AtomicInteger fallbackCount = new AtomicInteger(0);

    for (int i = 0; i < threadCount; i++) {
      executor.submit(
          () -> {
            try {
              latch.await();
              TravelIntent intent = service.createManual(owner, command, idempotencyKey);
              if (intent != null) {
                successCount.incrementAndGet();
              }
            } catch (DuplicateKeyException e) {
              fallbackCount.incrementAndGet();
            } catch (Exception e) {
              // Ignored
            } finally {
              done.countDown();
            }
          });
    }

    latch.countDown();
    done.await();
    executor.shutdown();

    // Since we handle DuplicateKeyException internally in createManual and return the existing
    // intent,
    // all 10 threads should get the same intent returned, but only 1 document should exist in
    // Mongo!
    assertThat(successCount.get()).isEqualTo(10);

    // Verify only one document is stored
    assertThat(mongo.getCollection("travel_intents").countDocuments()).isEqualTo(1);
  }
}
