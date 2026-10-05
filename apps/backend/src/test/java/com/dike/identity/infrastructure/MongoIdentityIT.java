package com.dike.identity.infrastructure;

import static org.junit.jupiter.api.Assertions.*;

import com.mongodb.client.MongoClients;
import java.time.Clock;
import java.util.concurrent.Executors;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.MongoTransactionManager;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.SimpleMongoClientDatabaseFactory;
import org.springframework.data.mongodb.core.index.Index;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
class MongoIdentityIT {
  @Container static MongoDBContainer mongo = new MongoDBContainer("mongo:8.0");

  @Test
  void sameSubjectHasOneAccountAndEmailDoesNotMergeIdentity() throws Exception {
    try (var client = MongoClients.create(mongo.getReplicaSetUrl())) {
      var factory = new SimpleMongoClientDatabaseFactory(client, "dike_identity_test");
      var template = new MongoTemplate(factory);
      template.createCollection("users");
      template.createCollection("auth_identities");
      template
          .indexOps("auth_identities")
          .ensureIndex(
              new Index()
                  .on("provider", Sort.Direction.ASC)
                  .on("subject", Sort.Direction.ASC)
                  .unique());
      var store =
          new MongoAccountStore(template, new MongoTransactionManager(factory), Clock.systemUTC());
      try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
        var a = executor.submit(() -> store.login("sub-a", "Synthetic", "test@example.invalid"));
        var b = executor.submit(() -> store.login("sub-a", "Synthetic", "test@example.invalid"));
        assertEquals(a.get().id(), b.get().id());
      }
      assertEquals(1, template.getCollection("users").countDocuments());
      var other = store.login("sub-b", "Synthetic", "test@example.invalid");
      var original = store.login("sub-a", "Synthetic", "changed@example.invalid");
      assertNotEquals(other.id(), original.id());
      assertEquals(2, template.getCollection("users").countDocuments());
    }
  }
}
