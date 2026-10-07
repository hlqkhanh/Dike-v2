package com.dike.planning.infrastructure.mongo;

import com.dike.shared.infrastructure.migration.MongoMigration;
import org.bson.Document;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.CompoundIndexDefinition;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.PartialIndexFilter;
import org.springframework.stereotype.Component;

@Component
public class PlanningIndexesMigration implements MongoMigration {

  @Override
  public String id() {
    return "V007__planning_schedule_indexes";
  }

  @Override
  public String checksum() {
    return "sha256:planning-schedule-indexes-v1";
  }

  @Override
  public void apply(MongoTemplate mongo) {
    mongo
        .indexOps("schedule_rules")
        .ensureIndex(
            new CompoundIndexDefinition(
                    new Document("ownerUserId", 1)
                        .append("status", 1)
                        .append("effectiveFrom", 1)
                        .append("effectiveUntil", 1))
                .named("ix_schedule_owner_status_range"));
    mongo
        .indexOps("schedule_exceptions")
        .ensureIndex(
            new CompoundIndexDefinition(new Document("scheduleId", 1).append("localDate", 1))
                .unique()
                .named("uq_schedule_exception_date"));
    mongo
        .indexOps("travel_intents")
        .ensureIndex(
            new CompoundIndexDefinition(
                    new Document("scheduleId", 1).append("localDate", 1).append("direction", 1))
                .partial(PartialIndexFilter.of(new Document("sourceType", "SCHEDULE")))
                .unique()
                .named("uq_scheduled_intent_direction"));
    mongo
        .indexOps("travel_intents")
        .ensureIndex(
            new Index()
                .on("ownerUserId", Sort.Direction.ASC)
                .on("localDate", Sort.Direction.ASC)
                .on("commitmentState", Sort.Direction.ASC)
                .named("ix_intent_owner_date_state"));
    mongo
        .indexOps("route_snapshots")
        .ensureIndex(
            new Index()
                .on("ownerUserId", Sort.Direction.ASC)
                .on("expiresAt", Sort.Direction.ASC)
                .named("ix_route_owner_expiry"));
  }
}
