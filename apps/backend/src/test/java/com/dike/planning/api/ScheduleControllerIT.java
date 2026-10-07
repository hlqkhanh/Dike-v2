package com.dike.planning.api;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dike.identity.IdentityAccess;
import com.dike.planning.application.ResolvedPlaceStore;
import com.dike.planning.application.ScheduleService;
import com.dike.planning.domain.ActivityCategory;
import com.dike.planning.domain.PlaceSnapshot;
import com.dike.planning.domain.ScheduleDirection;
import com.dike.planning.domain.ScheduleVisibility;
import com.dike.planning.domain.TravelRole;
import com.dike.planning.infrastructure.mongo.MongoPlanningStore;
import com.dike.planning.infrastructure.mongo.PlanningIndexesMigration;
import com.dike.shared.api.GlobalExceptionHandler;
import com.dike.shared.outbox.OutboxPublisher;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.SimpleMongoClientDatabaseFactory;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@Testcontainers(disabledWithoutDocker = true)
class ScheduleControllerIT {

  @Container
  private static final MongoDBContainer MONGO =
      new MongoDBContainer(DockerImageName.parse("mongo:8.0.32-noble"));

  private static MongoClient client;
  private static MongoTemplate mongo;
  private ScheduleService service;
  private MockMvc mvc;
  private ObjectMapper json;

  private IdentityAccess accounts;
  private com.dike.community.SocialAccessPolicy social;
  private ResolvedPlaceStore places;
  private OutboxPublisher events;
  private Clock clock;

  @BeforeAll
  static void connect() {
    client = MongoClients.create(MONGO.getReplicaSetUrl());
    mongo =
        new MongoTemplate(new SimpleMongoClientDatabaseFactory(client, "dike_planning_api_test"));
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
    social = mock(com.dike.community.SocialAccessPolicy.class);
    places = mock(ResolvedPlaceStore.class);
    events = mock(OutboxPublisher.class);
    clock = Clock.fixed(Instant.parse("2026-10-07T00:00:00Z"), ZoneId.of("UTC"));

    service =
        new ScheduleService(
            store, places, accounts, social, events, clock, () -> "test-id-" + System.nanoTime());
    ScheduleController controller = new ScheduleController(service, clock);

    mvc =
        MockMvcBuilders.standaloneSetup(controller)
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();

    json = new ObjectMapper();
    json.registerModule(new JavaTimeModule());

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
  void createScheduleReturnsWarningsForConflict() throws Exception {
    ScheduleController.RuleRequest req1 =
        new ScheduleController.RuleRequest(
            "Schedule 1",
            ActivityCategory.WORK,
            Set.of(DayOfWeek.MONDAY),
            LocalDate.parse("2026-10-12"), // a Monday
            null,
            LocalTime.of(8, 0),
            LocalTime.of(10, 0),
            "Asia/Ho_Chi_Minh",
            "test-place-1",
            "test-place-2",
            15,
            Set.of(ScheduleDirection.OUTBOUND),
            TravelRole.RIDER,
            ScheduleVisibility.PRIVATE);

    String res1 =
        mvc.perform(
                post("/api/v1/schedules")
                    .principal(() -> "test-user")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsString(req1)))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();

    String id1 = json.readTree(res1).get("id").asText();

    // Create a conflicting schedule
    ScheduleController.RuleRequest req2 =
        new ScheduleController.RuleRequest(
            "Schedule 2",
            ActivityCategory.WORK,
            Set.of(DayOfWeek.MONDAY),
            LocalDate.parse("2026-10-12"), // a Monday
            null,
            LocalTime.of(9, 0),
            LocalTime.of(11, 0), // Overlaps with 8:00 - 10:00
            "Asia/Ho_Chi_Minh",
            "test-place-1",
            "test-place-2",
            15,
            Set.of(ScheduleDirection.OUTBOUND),
            TravelRole.RIDER,
            ScheduleVisibility.PRIVATE);

    mvc.perform(
            post("/api/v1/schedules")
                .principal(() -> "test-user")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(req2)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.warnings").isArray())
        .andExpect(jsonPath("$.warnings[0].conflictingScheduleId").value(id1));
  }
}
