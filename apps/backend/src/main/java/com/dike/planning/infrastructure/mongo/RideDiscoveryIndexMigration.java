package com.dike.planning.infrastructure.mongo;

import com.dike.shared.infrastructure.migration.MongoMigration;
import org.springframework.data.domain.Sort.Direction;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.stereotype.Component;

@Component
public class RideDiscoveryIndexMigration implements MongoMigration {
  public String id() {
    return "V022_3__ride_discovery_index";
  }

  public String checksum() {
    return "ride-discovery-index-v1";
  }

  public void apply(MongoTemplate mongo) {
    mongo
        .indexOps("ride_posts")
        .ensureIndex(
            new Index()
                .on("status", Direction.ASC)
                .on("type", Direction.ASC)
                .on("departureAt", Direction.ASC)
                .on("_id", Direction.ASC)
                .named("ride_discovery_time"));
  }
}
