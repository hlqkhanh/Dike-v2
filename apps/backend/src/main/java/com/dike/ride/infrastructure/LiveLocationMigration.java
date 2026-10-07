package com.dike.ride.infrastructure;

import com.dike.shared.infrastructure.migration.MongoMigration;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.stereotype.Component;

@Component
class LiveLocationMigration implements MongoMigration {
  public String id() {
    return "V013_0__live_location_consents";
  }

  public String checksum() {
    return "live-location-consents-v1";
  }

  public void apply(MongoTemplate mongo) {
    if (!mongo.collectionExists("live_location_consents"))
      mongo.createCollection("live_location_consents");
    mongo
        .indexOps("live_location_consents")
        .ensureIndex(
            new Index()
                .on("bookingId", Sort.Direction.ASC)
                .on("userId", Sort.Direction.ASC)
                .unique());
  }
}
