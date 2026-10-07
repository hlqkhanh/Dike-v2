package com.dike.ride.infrastructure;

import com.dike.shared.infrastructure.migration.MongoMigration;
import java.util.List;
import org.bson.Document;
import org.springframework.data.domain.Sort.Direction;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.PartialIndexFilter;
import org.springframework.stereotype.Component;

@Component
public class RideMigration implements MongoMigration {
  public String id() {
    return "V010_1__trips_and_bookings";
  }

  public String checksum() {
    return "trips-bookings-v1";
  }

  public void apply(MongoTemplate mongo) {
    for (String name :
        List.of("trips", "ride_proposals", "bookings", "ride_intervals", "boarding_secrets"))
      if (!mongo.collectionExists(name)) mongo.createCollection(name);
    mongo
        .indexOps("trips")
        .ensureIndex(new Index().on("driverId", Direction.ASC).on("_id", Direction.ASC));
    mongo
        .indexOps("trips")
        .ensureIndex(new Index().on("status", Direction.ASC).on("departureAt", Direction.ASC));
    mongo
        .indexOps("ride_proposals")
        .ensureIndex(
            new Index()
                .on("intentId", Direction.ASC)
                .on("tripId", Direction.ASC)
                .unique()
                .partial(PartialIndexFilter.of(new Document("status", "PENDING")))
                .named("one_pending_pair"));
    mongo
        .indexOps("ride_proposals")
        .ensureIndex(
            new Index()
                .on("intentId", Direction.ASC)
                .unique()
                .partial(
                    PartialIndexFilter.of(
                        new Document("status", "PENDING").append("direction", "PASSENGER_REQUEST")))
                .named("one_passenger_request"));
    mongo
        .indexOps("ride_proposals")
        .ensureIndex(new Index().on("status", Direction.ASC).on("expiresAt", Direction.ASC));
    mongo
        .indexOps("ride_proposals")
        .ensureIndex(new Index().on("tripId", Direction.ASC).on("status", Direction.ASC));
    mongo.indexOps("bookings").ensureIndex(new Index().on("proposalId", Direction.ASC).unique());
    mongo
        .indexOps("bookings")
        .ensureIndex(
            new Index()
                .on("intentId", Direction.ASC)
                .unique()
                .partial(
                    PartialIndexFilter.of(
                        new Document(
                            "status",
                            new Document(
                                "$in",
                                List.of("CONFIRMED", "DRIVER_ARRIVED", "BOARDED", "IN_PROGRESS")))))
                .named("one_active_intent"));
    mongo.indexOps("bookings").ensureIndex(new Index().on("tripId", Direction.ASC));
    for (String collection : List.of("bookings", "ride_proposals"))
      for (String participant : List.of("passengerId", "driverId"))
        mongo
            .indexOps(collection)
            .ensureIndex(new Index().on(participant, Direction.ASC).on("_id", Direction.ASC));
    mongo
        .indexOps("ride_intervals")
        .ensureIndex(
            new Index()
                .on("userId", Direction.ASC)
                .on("startAt", Direction.ASC)
                .on("endAt", Direction.ASC));
  }
}
