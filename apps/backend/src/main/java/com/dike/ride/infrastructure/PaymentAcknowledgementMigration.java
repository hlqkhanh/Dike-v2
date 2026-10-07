package com.dike.ride.infrastructure;

import com.dike.shared.infrastructure.migration.MongoMigration;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Component;

@Component
class PaymentAcknowledgementMigration implements MongoMigration {
  public String id() {
    return "V014_0__payment_acknowledgements";
  }

  public String checksum() {
    return "payment-acknowledgements-v1";
  }

  public void apply(MongoTemplate mongo) {
    if (!mongo.collectionExists("payment_acknowledgements"))
      mongo.createCollection("payment_acknowledgements");
  }
}
