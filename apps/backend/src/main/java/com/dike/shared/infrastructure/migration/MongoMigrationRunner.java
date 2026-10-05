package com.dike.shared.infrastructure.migration;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.bson.Document;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(
    prefix = "dike.migrations",
    name = "enabled",
    havingValue = "true",
    matchIfMissing = true)
class MongoMigrationRunner implements ApplicationRunner {

  private static final String MIGRATIONS = "dike_migrations";
  private static final String LOCKS = "dike_migration_locks";
  private final MongoTemplate template;
  private final List<MongoMigration> migrations;
  private final Clock clock;
  private final String owner = UUID.randomUUID().toString();

  MongoMigrationRunner(MongoTemplate template, List<MongoMigration> migrations, Clock clock) {
    this.template = template;
    this.migrations = migrations;
    this.clock = clock;
  }

  @Override
  public void run(ApplicationArguments arguments) {
    acquireLock();
    try {
      migrations.stream().sorted(Comparator.comparing(MongoMigration::id)).forEach(this::apply);
    } finally {
      template.remove(
          Query.query(Criteria.where("_id").is("global").and("owner").is(owner)), LOCKS);
    }
  }

  private void acquireLock() {
    Instant now = clock.instant();
    Query query =
        Query.query(
            Criteria.where("_id")
                .is("global")
                .orOperator(
                    Criteria.where("owner").is(owner),
                    Criteria.where("expiresAt").lt(now),
                    Criteria.where("expiresAt").exists(false)));
    Update update =
        new Update().set("owner", owner).set("expiresAt", now.plus(Duration.ofMinutes(2)));
    Document lock =
        template.findAndModify(
            query,
            update,
            FindAndModifyOptions.options().upsert(true).returnNew(true),
            Document.class,
            LOCKS);
    if (lock == null || !owner.equals(lock.getString("owner"))) {
      throw new IllegalStateException("MongoDB migration lock is held by another process");
    }
  }

  private void apply(MongoMigration migration) {
    Document applied = template.findById(migration.id(), Document.class, MIGRATIONS);
    if (applied != null) {
      if (!migration.checksum().equals(applied.getString("checksum"))) {
        throw new IllegalStateException("Checksum changed for migration " + migration.id());
      }
      return;
    }

    migration.apply(template);
    template.insert(
        new Document("_id", migration.id())
            .append("checksum", migration.checksum())
            .append("appliedAt", clock.instant()),
        MIGRATIONS);
  }
}
