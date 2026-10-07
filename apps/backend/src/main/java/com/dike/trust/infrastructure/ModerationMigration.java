package com.dike.trust.infrastructure;

import com.dike.shared.infrastructure.migration.MongoMigration;
import java.util.Map;
import org.bson.Document;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.PartialIndexFilter;
import org.springframework.stereotype.Component;

@Component
class ModerationMigration implements MongoMigration {
  public String id() {
    return "V014_2__generic_reports_and_audit";
  }

  public String checksum() {
    return "generic-reports-audit-v1";
  }

  public void apply(MongoTemplate mongo) {
    for (String name : new String[] {"reports", "audit_logs"})
      if (!mongo.collectionExists(name)) mongo.createCollection(name);
    mongo
        .indexOps("reports")
        .ensureIndex(
            new Index()
                .on("status", Sort.Direction.ASC)
                .on("priority", Sort.Direction.ASC)
                .on("createdAt", Sort.Direction.ASC)
                .on("_id", Sort.Direction.ASC));
    mongo
        .indexOps("reports")
        .ensureIndex(
            new Index()
                .on("assignedTo", Sort.Direction.ASC)
                .on("status", Sort.Direction.ASC)
                .on("updatedAt", Sort.Direction.ASC));
    mongo
        .indexOps("reports")
        .ensureIndex(
            new Index()
                .on("targetType", Sort.Direction.ASC)
                .on("targetId", Sort.Direction.ASC)
                .on("status", Sort.Direction.ASC));
    mongo
        .indexOps("reports")
        .ensureIndex(
            new Index().on("reporterId", Sort.Direction.ASC).on("createdAt", Sort.Direction.DESC));
    mongo
        .indexOps("reports")
        .ensureIndex(
            new Index()
                .on("reporterId", Sort.Direction.ASC)
                .on("targetType", Sort.Direction.ASC)
                .on("targetId", Sort.Direction.ASC)
                .unique()
                .partial(
                    PartialIndexFilter.of(
                        new Document(
                            "status",
                            new Document(
                                "$in", java.util.List.of("RECEIVED", "TRIAGED", "IN_REVIEW")))))
                .named("one_open_report"));
    mongo
        .indexOps("audit_logs")
        .ensureIndex(
            new Index().on("occurredAt", Sort.Direction.DESC).on("_id", Sort.Direction.DESC));
    if (mongo.collectionExists("post_reports")) {
      for (Document old : mongo.findAll(Document.class, "post_reports")) {
        Object rawId = old.get("_id");
        if (rawId == null) continue;
        String id = rawId.toString();
        if (mongo.findById(id, Document.class, "reports") == null) {
          mongo.insert(
              new Document("_id", id)
                  .append("reporterId", old.getString("reporterId"))
                  .append("targetType", "POST")
                  .append("targetId", old.getString("postId"))
                  .append("reason", old.getString("reason"))
                  .append("status", "RECEIVED")
                  .append("priority", "P2")
                  .append("evidenceSnapshot", Map.of("legacy", "true"))
                  .append("createdAt", old.get("createdAt"))
                  .append("updatedAt", old.get("createdAt"))
                  .append("version", 0L),
              "reports");
        }
      }
    }
  }
}
