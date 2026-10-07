package com.dike.planning.infrastructure;

import com.dike.shared.infrastructure.migration.MongoMigration;
import org.bson.Document;
import org.springframework.data.domain.Sort.Direction;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.*;
import org.springframework.stereotype.Component;

@Component
public class PostMigration implements MongoMigration {
  public String id() {
    return "V009_1__ride_posts";
  }

  public String checksum() {
    return "ride-posts-v1";
  }

  public void apply(MongoTemplate mongo) {
    mongo
        .indexOps("ride_posts")
        .ensureIndex(new Index().on("publishedAt", Direction.DESC).on("_id", Direction.DESC));
    for (String name :
        java.util.List.of("ride_posts", "saved_posts", "post_source_routes", "post_revisions"))
      if (!mongo.collectionExists(name)) mongo.createCollection(name);
    mongo
        .indexOps("ride_posts")
        .ensureIndex(
            new Index()
                .on("sourceId", Direction.ASC)
                .unique()
                .partial(
                    PartialIndexFilter.of(
                        new Document("status", "OPEN").append("type", "NEED_RIDE")))
                .named("one_open_need"));
    mongo
        .indexOps("ride_posts")
        .ensureIndex(
            new Index()
                .on("sourceId", Direction.ASC)
                .unique()
                .partial(PartialIndexFilter.of(new Document("type", "OFFER_RIDE")))
                .named("one_offer_per_trip"));
    mongo
        .indexOps("ride_posts")
        .ensureIndex(new Index().on("ownerId", Direction.ASC).on("_id", Direction.ASC));
    mongo
        .indexOps("ride_posts")
        .ensureIndex(new Index().on("status", Direction.ASC).on("expiresAt", Direction.ASC));
    mongo
        .indexOps("saved_posts")
        .ensureIndex(new Index().on("viewer", Direction.ASC).on("post", Direction.ASC).unique());
  }
}
