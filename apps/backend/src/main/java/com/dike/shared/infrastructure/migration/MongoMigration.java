package com.dike.shared.infrastructure.migration;

import org.springframework.data.mongodb.core.MongoTemplate;

public interface MongoMigration {

  String id();

  String checksum();

  void apply(MongoTemplate template);
}
