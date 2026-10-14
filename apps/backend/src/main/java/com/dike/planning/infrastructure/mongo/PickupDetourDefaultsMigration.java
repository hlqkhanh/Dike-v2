package com.dike.planning.infrastructure.mongo;

import com.dike.shared.infrastructure.migration.MongoMigration;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.stereotype.Component;

/** Older creation forms silently wrote zero for both limits; new forms make this explicit. */
@Component
public class PickupDetourDefaultsMigration implements MongoMigration {
  public String id() {
    return "V022_2__pickup_detour_defaults";
  }

  public String checksum() {
    return "pickup-detour-defaults-v1";
  }

  public void apply(MongoTemplate mongo) {
    mongo.updateMulti(
        Query.query(Criteria.where("detourMeters").is(0).and("detourSeconds").is(0)),
        new Update()
            .set("detourMeters", 1000L)
            .set("detourSeconds", 300L)
            .inc("version", 1L)
            .inc("termsVersion", 1L),
        "trips");
  }
}
