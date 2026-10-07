package com.dike.planning.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dike.community.SocialAccessPolicy;
import com.dike.identity.IdentityAccess;
import com.dike.planning.api.ScheduleController.MatchRequest;
import com.dike.planning.application.ResolvedPlaceStore;
import com.dike.planning.application.ScheduleService;
import com.dike.planning.application.ScheduleService.RuleCommand;
import com.dike.planning.domain.ActivityCategory;
import com.dike.planning.domain.PlaceSnapshot;
import com.dike.planning.domain.ScheduleDirection;
import com.dike.planning.domain.ScheduleRule;
import com.dike.planning.domain.TravelRole;
import com.dike.planning.infrastructure.mongo.MongoPlanningStore;
import com.dike.planning.infrastructure.mongo.PlanningIndexesMigration;
import com.dike.shared.api.GlobalExceptionHandler;
import com.dike.shared.outbox.OutboxPublisher;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import java.security.Principal;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
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

@Testcontainers(disabledWithoutDocker = true)
class ScheduleMatchingIT {

  @Container
  private static final MongoDBContainer MONGO =
      new MongoDBContainer("mongo:8.0.32-noble").withExposedPorts(27017);

  private static MongoClient client;
  private static MongoTemplate mongo;

  private MockMvc mvc;
  private ObjectMapper json;
  private ScheduleService service;

  private IdentityAccess accounts;
  private SocialAccessPolicy social;
  private ResolvedPlaceStore places;

  @BeforeAll
  static void connect() {
    client = MongoClients.create(MONGO.getConnectionString());
    mongo =
        new MongoTemplate(new SimpleMongoClientDatabaseFactory(client, "dike_planning_match_test"));
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
    social = mock(SocialAccessPolicy.class);
    places = mock(ResolvedPlaceStore.class);
    OutboxPublisher events = mock(OutboxPublisher.class);
    Clock clock = Clock.fixed(Instant.parse("2026-10-07T00:00:00Z"), ZoneId.of("UTC"));

    service =
        new ScheduleService(
            store, places, accounts, social, events, clock, () -> UUID.randomUUID().toString());
    ScheduleController controller = new ScheduleController(service, clock);

    mvc =
        MockMvcBuilders.standaloneSetup(controller)
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
    json = new ObjectMapper();
    json.registerModule(new JavaTimeModule());

    // Basic mocks
    when(accounts.require(any()))
        .thenAnswer(
            inv ->
                new IdentityAccess.Access(
                    inv.getArgument(0), true, true, true, IdentityAccess.DriverEvidence.REAL, 0L));
    when(social.canRead(any(), any(), any(), anyBoolean())).thenReturn(true);
  }

  @Test
  void matchesSchedulesWithOverlappingTimeAndLocation() throws Exception {
    Instant now = Instant.parse("2026-10-07T00:00:00Z");

    // User 1: DRIVER
    PlaceSnapshot home1 =
        new PlaceSnapshot("GOONG", "h1", "Home 1", "District 1", 106.6, 10.7, now);
    PlaceSnapshot school1 =
        new PlaceSnapshot("GOONG", "s1", "School 1", "District 3", 106.7, 10.8, now);
    when(places.find("user-1", "test-ref-h1")).thenReturn(Optional.of(home1));
    when(places.find("user-1", "test-ref-s1")).thenReturn(Optional.of(school1));

    ScheduleRule s1 =
        service.create(
            "user-1",
            new RuleCommand(
                "Driver Schedule",
                ActivityCategory.STUDY,
                Set.of(DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY),
                LocalDate.parse("2026-10-01"),
                LocalDate.parse("2026-12-31"),
                LocalTime.parse("07:00"),
                LocalTime.parse("11:00"),
                "Asia/Ho_Chi_Minh",
                "test-ref-s1",
                "test-ref-h1",
                15,
                Set.of(ScheduleDirection.OUTBOUND),
                TravelRole.DRIVER,
                com.dike.planning.domain.ScheduleVisibility.FRIENDS));

    // User 2: PASSENGER, overlapping time and very close location
    PlaceSnapshot home2 =
        new PlaceSnapshot("GOONG", "h2", "Home 2", "District 1", 106.601, 10.701, now);
    PlaceSnapshot school2 =
        new PlaceSnapshot("GOONG", "s2", "School 2", "District 3", 106.702, 10.802, now);
    when(places.find("user-2", "test-ref-h2")).thenReturn(Optional.of(home2));
    when(places.find("user-2", "test-ref-s2")).thenReturn(Optional.of(school2));

    ScheduleRule s2 =
        service.create(
            "user-2",
            new RuleCommand(
                "Passenger Schedule",
                ActivityCategory.STUDY,
                Set.of(DayOfWeek.MONDAY),
                LocalDate.parse("2026-10-01"),
                LocalDate.parse("2026-12-31"),
                LocalTime.parse("07:15"),
                LocalTime.parse("11:15"),
                "Asia/Ho_Chi_Minh",
                "test-ref-s2",
                "test-ref-h2",
                15,
                Set.of(ScheduleDirection.OUTBOUND),
                TravelRole.RIDER,
                com.dike.planning.domain.ScheduleVisibility.FRIENDS));

    // User 3: PASSENGER, different day
    PlaceSnapshot home3 =
        new PlaceSnapshot("GOONG", "h3", "Home 3", "District 1", 106.6, 10.7, now);
    PlaceSnapshot school3 =
        new PlaceSnapshot("GOONG", "s3", "School 3", "District 3", 106.7, 10.8, now);
    when(places.find("user-3", "test-ref-h3")).thenReturn(Optional.of(home3));
    when(places.find("user-3", "test-ref-s3")).thenReturn(Optional.of(school3));

    ScheduleRule s3 =
        service.create(
            "user-3",
            new RuleCommand(
                "Passenger 3",
                ActivityCategory.STUDY,
                Set.of(DayOfWeek.TUESDAY),
                LocalDate.parse("2026-10-01"),
                LocalDate.parse("2026-12-31"),
                LocalTime.parse("07:00"),
                LocalTime.parse("11:00"),
                "Asia/Ho_Chi_Minh",
                "test-ref-s3",
                "test-ref-h3",
                15,
                Set.of(ScheduleDirection.OUTBOUND),
                TravelRole.RIDER,
                com.dike.planning.domain.ScheduleVisibility.FRIENDS));

    // Match request from user-1 for RIDER
    MatchRequest req = new MatchRequest(5.0, 30, TravelRole.RIDER);
    Principal principal = () -> "user-1";

    String response =
        mvc.perform(
                post("/api/v1/schedules/" + s1.id() + "/match")
                    .principal(principal)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsString(req)))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();

    ScheduleController.MatchResponse matchResult =
        json.readValue(response, ScheduleController.MatchResponse.class);

    // Only user-2 should match
    assertThat(matchResult.schedules()).hasSize(1);
    assertThat(matchResult.schedules().getFirst().ownerUserId()).isEqualTo("user-2");
    assertThat(matchResult.schedules().getFirst().publicAreaLabel()).isEqualTo("District 3");

    assertThat(matchResult.intents()).isEmpty();
  }
}
