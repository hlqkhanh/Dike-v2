package com.dike.planning.infrastructure.mongo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.dike.planning.domain.ActivityCategory;
import com.dike.planning.domain.PlaceSnapshot;
import com.dike.planning.domain.ScheduleDirection;
import com.dike.planning.domain.ScheduleException;
import com.dike.planning.domain.ScheduleExceptionType;
import com.dike.planning.domain.ScheduleRule;
import com.dike.planning.domain.ScheduleStatus;
import com.dike.planning.domain.ScheduleVisibility;
import com.dike.planning.domain.TravelIntent;
import com.dike.planning.domain.TravelIntentCommitmentState;
import com.dike.planning.domain.TravelIntentSourceType;
import com.dike.planning.domain.TravelRole;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Set;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.SimpleMongoClientDatabaseFactory;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@Testcontainers(disabledWithoutDocker = true)
class MongoPlanningStoreIT {

  private static final Instant NOW = Instant.parse("2026-10-07T00:00:00Z");

  @Container
  private static final MongoDBContainer MONGO =
      new MongoDBContainer(DockerImageName.parse("mongo:8.0.32-noble"));

  private static MongoClient client;
  private static MongoTemplate mongo;
  private MongoPlanningStore store;

  @BeforeAll
  static void connect() {
    client = MongoClients.create(MONGO.getReplicaSetUrl());
    mongo = new MongoTemplate(new SimpleMongoClientDatabaseFactory(client, "dike_planning_test"));
  }

  @AfterAll
  static void close() {
    if (client != null) client.close();
  }

  @BeforeEach
  void reset() {
    mongo.getDb().drop();
    new PlanningIndexesMigration().apply(mongo);
    store = new MongoPlanningStore(mongo);
  }

  @Test
  void persistsSnapshotsAndRejectsStaleScheduleWrites() {
    ScheduleRule initial = schedule(0, "Morning");
    store.insertSchedule(initial);
    assertThat(store.schedule(initial.id())).contains(initial);

    ScheduleRule updated = schedule(1, "Updated");
    store.replaceSchedule(initial, updated);
    assertThat(store.schedules("user-1")).containsExactly(updated);
    assertThatThrownBy(() -> store.replaceSchedule(initial, schedule(1, "Stale")))
        .isInstanceOf(OptimisticLockingFailureException.class);
  }

  @Test
  void enforcesOneExceptionAndScheduledIntentPerDateAndDirection() {
    store.insertSchedule(schedule(0, "Morning"));
    ScheduleException exception = exception("exception-1");
    store.insertException(exception);
    assertThat(store.exception("schedule-1", LocalDate.parse("2026-10-12"))).contains(exception);
    assertThatThrownBy(() -> store.insertException(exception("exception-2")))
        .isInstanceOf(DuplicateKeyException.class);

    TravelIntent first = intent("intent-1");
    store.insertIntent(first);
    assertThat(store.scheduledIntent("schedule-1", first.localDate(), ScheduleDirection.OUTBOUND))
        .contains(first);
    assertThatThrownBy(() -> store.insertIntent(intent("intent-2")))
        .isInstanceOf(DuplicateKeyException.class);
  }

  private ScheduleRule schedule(long version, String name) {
    return new ScheduleRule(
        "schedule-1",
        "user-1",
        name,
        ActivityCategory.STUDY,
        Set.of(DayOfWeek.MONDAY),
        LocalDate.parse("2026-10-07"),
        null,
        LocalTime.of(8, 0),
        LocalTime.of(10, 0),
        ScheduleRule.V1_ZONE,
        place("school"),
        place("home"),
        15,
        Set.of(ScheduleDirection.OUTBOUND, ScheduleDirection.RETURN),
        TravelRole.RIDER,
        ScheduleVisibility.PRIVATE,
        ScheduleStatus.ACTIVE,
        version,
        NOW,
        NOW);
  }

  private ScheduleException exception(String id) {
    return new ScheduleException(
        id,
        "schedule-1",
        "user-1",
        LocalDate.parse("2026-10-12"),
        ScheduleExceptionType.SKIP,
        null,
        null,
        null,
        null,
        Set.of(),
        0,
        NOW,
        NOW);
  }

  private TravelIntent intent(String id) {
    return new TravelIntent(
        id,
        "user-1",
        TravelIntentSourceType.SCHEDULE,
        "schedule-1",
        0,
        LocalDate.parse("2026-10-12"),
        ScheduleDirection.OUTBOUND,
        TravelRole.RIDER,
        place("home"),
        place("school"),
        null,
        Instant.parse("2026-10-12T00:45:00Z"),
        TravelIntentCommitmentState.PRIVATE,
        false,
        0,
        null,
        NOW,
        NOW);
  }

  private PlaceSnapshot place(String id) {
    return new PlaceSnapshot("GOONG", id, id, "Quận 1", 106.7, 10.77, NOW);
  }
}
