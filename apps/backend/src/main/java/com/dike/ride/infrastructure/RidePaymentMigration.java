package com.dike.ride.infrastructure;

import com.dike.shared.infrastructure.migration.MongoMigration;
import org.springframework.data.domain.Sort.Direction;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.stereotype.Component;

@Component
class RidePaymentMigration implements MongoMigration {
  public String id() {
    return "V015_0__payos_ride_payments";
  }

  public String checksum() {
    return "payos-ride-payments-v1";
  }

  public void apply(MongoTemplate mongo) {
    if (!mongo.collectionExists("ride_payments")) mongo.createCollection("ride_payments");
    mongo
        .indexOps("ride_payments")
        .ensureIndex(new Index().on("orderCode", Direction.ASC).unique());
    mongo
        .indexOps("ride_payments")
        .ensureIndex(new Index().on("status", Direction.ASC).on("updatedAt", Direction.ASC));
  }
}
