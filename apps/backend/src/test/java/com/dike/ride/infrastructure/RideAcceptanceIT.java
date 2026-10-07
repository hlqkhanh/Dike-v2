package com.dike.ride.infrastructure;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.dike.community.*;
import com.dike.planning.*;
import com.dike.planning.application.PostService;
import com.dike.planning.domain.RidePost;
import com.dike.planning.infrastructure.*;
import com.dike.ride.*;
import com.dike.ride.application.*;
import com.dike.ride.domain.*;
import com.dike.shared.api.ApiException;
import com.dike.shared.application.AtomicCommands;
import com.dike.shared.outbox.OutboxPublisher;
import com.mongodb.client.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.bson.Document;
import org.junit.jupiter.api.*;
import org.springframework.data.mongodb.MongoTransactionManager;
import org.springframework.data.mongodb.core.*;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.*;

@Testcontainers(disabledWithoutDocker = true)
class RideAcceptanceIT {
  @Container static final MongoDBContainer MONGO = new MongoDBContainer("mongo:8.0.32-noble");
  static MongoClient client;
  static MongoTemplate mongo;
  static final Instant NOW = Instant.parse("2026-10-07T01:00:00Z");
  AtomicCommands commands;
  MongoRideStore store;
  MongoPostStore posts;
  RideService service;
  OutboxPublisher outbox;
  MongoBoardingSecrets secrets;
  java.util.concurrent.atomic.AtomicReference<Instant> time;

  @BeforeAll
  static void connect() {
    client = MongoClients.create(MONGO.getReplicaSetUrl());
    mongo = new MongoTemplate(new SimpleMongoClientDatabaseFactory(client, "ride_acceptance_it"));
  }

  @AfterAll
  static void disconnect() {
    if (client != null) client.close();
  }

  @BeforeEach
  void setup() {
    mongo.getDb().drop();
    new RideMigration().apply(mongo);
    new PostMigration().apply(mongo);
    for (String name : List.of("command_guards", "command_receipts", "outbox_events"))
      mongo.createCollection(name);
    time = new java.util.concurrent.atomic.AtomicReference<>(NOW);
    Clock clock =
        new Clock() {
          public ZoneId getZone() {
            return ZoneOffset.UTC;
          }

          public Clock withZone(ZoneId zone) {
            return this;
          }

          public Instant instant() {
            return time.get();
          }
        };
    commands =
        new AtomicCommands(
            mongo, new MongoTransactionManager(mongo.getMongoDatabaseFactory()), clock);
    store = new MongoRideStore(mongo, commands);
    posts = new MongoPostStore(mongo);
    outbox = mock(OutboxPublisher.class);
    when(outbox.publish(anyString(), anyString(), anyString(), anyInt(), anyMap()))
        .thenAnswer(
            call -> {
              mongo.insert(
                  new Document("_id", UUID.randomUUID().toString())
                      .append("type", call.getArgument(0)),
                  "outbox_events");
              return null;
            });
    var access = mock(RideEligibility.class);
    when(access.active(anyString())).thenReturn(true);
    when(access.verified(anyString())).thenReturn(true);
    when(access.driver(anyString())).thenReturn(true);
    doAnswer(
            call -> {
              commands.fence("accounts", call.getArgument(0));
              return null;
            })
        .when(access)
        .fence(anyString());
    var accounts = mock(PostAccounts.class);
    when(accounts.active(anyString())).thenReturn(true);
    when(accounts.verified(anyString())).thenReturn(true);
    var social = mock(SocialAccessPolicy.class);
    when(social.canRead(anyString(), anyString(), any(), anyBoolean())).thenReturn(true);
    var journeys = mock(JourneySources.class);
    when(journeys.intent(anyString(), anyString()))
        .thenAnswer(
            call ->
                Optional.of(
                    new JourneySources.Intent(
                        call.getArgument(1),
                        call.getArgument(0),
                        0,
                        "A",
                        "B",
                        NOW.plusSeconds(3600),
                        NOW.plusSeconds(4000),
                        NOW.plusSeconds(7200),
                        "CAR",
                        "r")));
    var resources = mock(RideResources.class);
    doAnswer(
            call -> {
              commands.fence("vehicles", call.getArgument(0));
              return null;
            })
        .when(resources)
        .fenceVehicle(anyString(), anyLong());
    var community = mock(CommunityAccess.class);
    var postService =
        new PostService(
            posts,
            journeys,
            new RideTripSource(store),
            accounts,
            community,
            social,
            commands,
            outbox,
            clock);
    secrets =
        new MongoBoardingSecrets(
            mongo, commands, clock, Base64.getEncoder().encodeToString(new byte[32]));
    service =
        new RideService(
            store,
            resources,
            access,
            journeys,
            postService,
            social,
            new SocialAcceptanceGuard(commands),
            community,
            commands,
            outbox,
            secrets,
            clock);
  }

  void seedTrip(String id, String driver, int seats) {
    store.insertTrip(
        new Trip(
            id,
            driver,
            "v-" + driver,
            "CAR",
            0,
            Trip.Status.OPEN,
            seats,
            seats,
            "r",
            0,
            0,
            NOW.plusSeconds(3600),
            NOW.plusSeconds(7200),
            "A",
            "B",
            "PUBLIC",
            null,
            1000,
            5000,
            900,
            List.of(),
            0));
    posts.insert(
        new RidePost(
            "offer-" + id,
            driver,
            RidePost.Type.OFFER_RIDE,
            id,
            0,
            RidePost.Status.OPEN,
            "PUBLIC",
            null,
            "A",
            "B",
            "CAR",
            "r",
            NOW.plusSeconds(3600),
            NOW.plusSeconds(3600),
            "",
            0,
            0,
            null,
            NOW));
    commands.transaction(
        () -> {
          store.reserveInterval(
              driver, "trip:" + id, NOW.plusSeconds(3600), NOW.plusSeconds(8100), id);
          return null;
        });
  }

  void seedProposal(String id, String passenger, String trip, String driver, String intent) {
    if (posts.find("post-" + intent).isEmpty())
      posts.insert(
          new RidePost(
              "post-" + intent,
              passenger,
              RidePost.Type.NEED_RIDE,
              intent,
              0,
              RidePost.Status.OPEN,
              "PUBLIC",
              null,
              "A",
              "B",
              "CAR",
              "r",
              NOW.plusSeconds(3600),
              NOW.plusSeconds(4000),
              "",
              0,
              0,
              null,
              NOW));
    var quote =
        new RideResources.Quote(
            "quote-" + id,
            intent,
            trip,
            passenger,
            driver,
            0,
            0,
            "r",
            25000,
            NOW.plusSeconds(3600),
            NOW.plusSeconds(5400),
            NOW.plusSeconds(300),
            List.of(
                new RideResources.Stop("pickup-" + id, null, "PICKUP", "A", NOW.plusSeconds(3600)),
                new RideResources.Stop(
                    "dropoff-" + id, null, "DROPOFF", "B", NOW.plusSeconds(5400))),
            1000,
            300);
    store.insertProposal(
        new Proposal(
            id,
            "post-" + intent,
            intent,
            trip,
            passenger,
            driver,
            driver,
            passenger,
            Proposal.Direction.DRIVER_OFFER,
            Proposal.Status.PENDING,
            null,
            0,
            quote,
            NOW.plusSeconds(300),
            0));
  }

  @Test
  void twoRecipientsRacingForLastSeatCreateExactlyOneBooking() throws Exception {
    seedTrip("t", "d", 1);
    seedProposal("p1", "u1", "t", "d", "i1");
    seedProposal("p2", "u2", "t", "d", "i2");
    assertThat(
            race(
                () -> service.accept("u1", "p1", 0, "accept-key-1"),
                () -> service.accept("u2", "p2", 0, "accept-key-2")))
        .isEqualTo(1);
    assertThat(store.trip("t").orElseThrow().remainingSeats()).isZero();
    assertThat(mongo.getCollection("bookings").countDocuments()).isEqualTo(1);
    assertThat(posts.find("offer-t").orElseThrow().status()).isEqualTo(RidePost.Status.MATCHED);
  }

  @Test
  void oneIntentCannotAcceptTwoDriversConcurrently() throws Exception {
    seedTrip("t1", "d1", 1);
    seedTrip("t2", "d2", 1);
    seedProposal("p1", "u", "t1", "d1", "i");
    seedProposal("p2", "u", "t2", "d2", "i");
    assertThat(
            race(
                () -> service.accept("u", "p1", 0, "accept-key-1"),
                () -> service.accept("u", "p2", 0, "accept-key-2")))
        .isEqualTo(1);
    assertThat(mongo.getCollection("bookings").countDocuments()).isEqualTo(1);
    assertThat(
            store.trip("t1").orElseThrow().remainingSeats()
                + store.trip("t2").orElseThrow().remainingSeats())
        .isEqualTo(1);
  }

  @Test
  void replayAndConcurrentAcceptDoNotDoubleSpendSeat() throws Exception {
    seedTrip("t", "d", 1);
    seedProposal("p", "u", "t", "d", "i");
    assertThat(
            race(
                () -> service.accept("u", "p", 0, "accept-key-1"),
                () -> service.accept("u", "p", 0, "accept-key-1")))
        .isEqualTo(2);
    var b = service.accept("u", "p", 0, "another-key");
    assertThat(service.accept("u", "p", 0, "accept-key-1").id()).isEqualTo(b.id());
    assertThat(mongo.getCollection("bookings").countDocuments()).isEqualTo(1);
    assertThat(store.trip("t").orElseThrow().remainingSeats()).isZero();
  }

  @Test
  void outboxFailureRollsBackBookingSeatPostSecretAndReceipt() {
    seedTrip("t", "d", 1);
    seedProposal("p", "u", "t", "d", "i");
    doThrow(new IllegalStateException("outage"))
        .when(outbox)
        .publish(anyString(), anyString(), anyString(), anyInt(), anyMap());
    assertThatThrownBy(() -> service.accept("u", "p", 0, "accept-key-1")).hasMessage("outage");
    for (String name : List.of("bookings", "boarding_secrets", "command_receipts", "outbox_events"))
      assertThat(mongo.getCollection(name).countDocuments()).as(name).isZero();
    assertThat(store.trip("t").orElseThrow().remainingSeats()).isEqualTo(1);
    assertThat(posts.find("post-i").orElseThrow().status()).isEqualTo(RidePost.Status.OPEN);
    assertThat(store.proposal("p").orElseThrow().status()).isEqualTo(Proposal.Status.PENDING);
  }

  @Test
  void overlappingPassengerIntervalsAcrossDistinctIntentsConflict() throws Exception {
    seedTrip("t1", "d1", 1);
    seedTrip("t2", "d2", 1);
    seedProposal("p1", "u", "t1", "d1", "i1");
    seedProposal("p2", "u", "t2", "d2", "i2");
    assertThat(
            race(
                () -> service.accept("u", "p1", 0, "accept-key-1"),
                () -> service.accept("u", "p2", 0, "accept-key-2")))
        .isEqualTo(1);
  }

  @Test
  void boardingFailuresPersistAndCiphertextIsConsumed() {
    commands.transaction(
        () -> {
          secrets.create("b");
          return null;
        });
    String code = secrets.reveal("b");
    assertThat(code).matches("[0-9]{6}");
    assertThat(mongo.findById("b", Document.class, "boarding_secrets").toJson())
        .doesNotContain(code);
    String wrong = code.equals("000000") ? "111111" : "000000";
    for (int i = 0; i < 5; i++) assertThat(secrets.attempt("b", wrong)).isFalse();
    assertThatThrownBy(() -> secrets.attempt("b", code)).isInstanceOf(ApiException.class);
    commands.transaction(
        () -> {
          secrets.create("c");
          return null;
        });
    assertThat(secrets.attempt("c", secrets.reveal("c"))).isTrue();
    commands.transaction(
        () -> {
          secrets.consume("c");
          return null;
        });
    assertThat(mongo.findById("c", Document.class, "boarding_secrets"))
        .doesNotContainKey("ciphertext");
    assertThatThrownBy(() -> secrets.reveal("c")).isInstanceOf(ApiException.class);
  }

  private int race(Runnable first, Runnable second) throws Exception {
    var gate = new CountDownLatch(1);
    try (var executor = Executors.newFixedThreadPool(2)) {
      var futures = new ArrayList<Future<Boolean>>();
      for (Runnable action : List.of(first, second))
        futures.add(
            executor.submit(
                () -> {
                  gate.await();
                  try {
                    action.run();
                    return true;
                  } catch (ApiException expected) {
                    return false;
                  }
                }));
      gate.countDown();
      int successes = 0;
      for (var future : futures) if (future.get(30, TimeUnit.SECONDS)) successes++;
      return successes;
    }
  }

  @Test
  void tripStartAndBoardingRaceNeverLeavesABoardedPassengerStuck() throws Exception {
    seedTrip("t", "d", 1);
    seedProposal("p", "u", "t", "d", "i");
    var b = service.accept("u", "p", 0, "accept-key");
    String code = service.code("u", b.id());
    time.set(NOW.plusSeconds(3500));
    assertThat(
            race(
                () -> service.tripAction("d", "t", 1, "start", null, "start-key"),
                () ->
                    service.bookingAction(
                        "d", b.id(), 0, Booking.Action.BOARD, null, code, "board-key")))
        .isEqualTo(2);
    assertThat(store.trip("t").orElseThrow().status()).isEqualTo(Trip.Status.IN_PROGRESS);
    assertThat(store.booking(b.id()).orElseThrow().status()).isEqualTo(Booking.Status.IN_PROGRESS);
  }

  @Test
  void cancellationReplayReturnsSeatOnceAndNeverReopensOwnerClosedOffer() {
    seedTrip("t", "d", 1);
    seedProposal("p", "u", "t", "d", "i");
    var b = service.accept("u", "p", 0, "accept-key");
    var offer = posts.find("offer-t").orElseThrow();
    posts.save(offer, offer.change(RidePost.Status.CLOSED, "OWNER_CLOSED", NOW));
    service.bookingAction(
        "u", b.id(), 0, Booking.Action.CANCEL, "changed plan", null, "cancel-key");
    service.bookingAction(
        "u", b.id(), 0, Booking.Action.CANCEL, "changed plan", null, "cancel-key");
    assertThat(store.trip("t").orElseThrow().remainingSeats()).isEqualTo(1);
    assertThat(posts.find("offer-t").orElseThrow().status()).isEqualTo(RidePost.Status.CLOSED);
  }
}
