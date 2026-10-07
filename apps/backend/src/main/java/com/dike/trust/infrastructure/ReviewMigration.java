package com.dike.trust.infrastructure;

import com.dike.shared.infrastructure.migration.MongoMigration;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.stereotype.Component;

@Component
class ReviewMigration implements MongoMigration {
  public String id() {
    return "V014_1__reviews_rating_indexes";
  }

  public String checksum() {
    return "reviews-rating-v1";
  }

  public void apply(MongoTemplate mongo) {
    for (String name : new String[] {"reviews", "rating_summaries"})
      if (!mongo.collectionExists(name)) mongo.createCollection(name);
    mongo
        .indexOps("reviews")
        .ensureIndex(
            new Index()
                .on("bookingId", Sort.Direction.ASC)
                .on("reviewerId", Sort.Direction.ASC)
                .unique());
    mongo
        .indexOps("reviews")
        .ensureIndex(
            new Index()
                .on("revieweeId", Sort.Direction.ASC)
                .on("revieweeRole", Sort.Direction.ASC)
                .on("publicationStatus", Sort.Direction.ASC)
                .on("moderationStatus", Sort.Direction.ASC)
                .on("_id", Sort.Direction.DESC));
    mongo
        .indexOps("reviews")
        .ensureIndex(
            new Index()
                .on("publicationStatus", Sort.Direction.ASC)
                .on("publishDeadline", Sort.Direction.ASC));
    mongo
        .indexOps("rating_summaries")
        .ensureIndex(
            new Index().on("userId", Sort.Direction.ASC).on("role", Sort.Direction.ASC).unique());
  }
}
