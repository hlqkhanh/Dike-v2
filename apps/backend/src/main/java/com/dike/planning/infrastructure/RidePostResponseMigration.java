package com.dike.planning.infrastructure;

import com.dike.shared.infrastructure.migration.MongoMigration;
import org.bson.Document;
import org.springframework.data.domain.Sort.Direction;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.PartialIndexFilter;
import org.springframework.stereotype.Component;

@Component
public class RidePostResponseMigration implements MongoMigration {
  public String id() {
    return "V022_2__ride_post_responses";
  }

  public String checksum() {
    return "ride-post-responses-v1";
  }

  public void apply(MongoTemplate mongo) {
    if (!mongo.collectionExists("ride_post_responses"))
      mongo.createCollection("ride_post_responses");
    mongo
        .indexOps("ride_post_responses")
        .ensureIndex(new Index().on("ownerId", Direction.ASC).on("createdAt", Direction.DESC));
    mongo
        .indexOps("ride_post_responses")
        .ensureIndex(new Index().on("requesterId", Direction.ASC).on("createdAt", Direction.DESC));
    mongo
        .indexOps("ride_post_responses")
        .ensureIndex(
            new Index()
                .on("postId", Direction.ASC)
                .on("requesterId", Direction.ASC)
                .unique()
                .partial(PartialIndexFilter.of(new Document("status", "PENDING")))
                .named("one_pending_post_response"));
  }
}
