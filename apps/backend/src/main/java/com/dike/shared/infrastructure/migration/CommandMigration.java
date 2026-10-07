package com.dike.shared.infrastructure.migration;

import java.time.Duration;
import org.springframework.data.domain.Sort.Direction;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.stereotype.Component;

@Component
class CommandMigration implements MongoMigration {
  public String id() {
    return "V009_0__atomic_commands";
  }

  public String checksum() {
    return "atomic-commands-v1";
  }

  public void apply(MongoTemplate mongo) {
    for (String name : java.util.List.of("command_receipts", "command_guards"))
      if (!mongo.collectionExists(name)) mongo.createCollection(name);
    mongo
        .indexOps("command_receipts")
        .ensureIndex(new Index().on("expiresAt", Direction.ASC).expire(Duration.ZERO));
  }
}
