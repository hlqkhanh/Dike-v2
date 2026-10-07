package com.dike.trust.infrastructure;

import com.dike.shared.infrastructure.migration.MongoMigration;
import com.dike.trust.application.PostReportService;
import java.time.Instant;
import org.bson.Document;
import org.springframework.data.domain.Sort.Direction;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.stereotype.Repository;

@Repository
class MongoPostReports implements PostReportService.Store, MongoMigration {
  private final MongoTemplate mongo;

  MongoPostReports(MongoTemplate mongo) {
    this.mongo = mongo;
  }

  public String id() {
    return "V009_2__post_reports";
  }

  public String checksum() {
    return "post-reports-v1";
  }

  public void apply(MongoTemplate mongo) {
    if (!mongo.collectionExists("post_reports")) mongo.createCollection("post_reports");
    mongo
        .indexOps("post_reports")
        .ensureIndex(new Index().on("reporter", Direction.ASC).on("createdAt", Direction.DESC));
  }

  public long recent(String reporter, Instant since) {
    return mongo.count(
        Query.query(Criteria.where("reporter").is(reporter).and("createdAt").gte(since)),
        "post_reports");
  }

  public void insert(
      String id, String reporter, String post, String reason, String note, Instant now) {
    mongo.insert(
        new Document("_id", id)
            .append("reporter", reporter)
            .append("postId", post)
            .append("reason", reason)
            .append("note", note)
            .append("status", "RECEIVED")
            .append("createdAt", java.util.Date.from(now)),
        "post_reports");
  }
}
