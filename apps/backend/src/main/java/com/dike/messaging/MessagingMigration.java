package com.dike.messaging;

import com.dike.shared.infrastructure.migration.MongoMigration;
import org.bson.Document;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.PartialIndexFilter;
import org.springframework.stereotype.Component;

@Component
class MessagingMigration implements MongoMigration {

  public String id() {
    return "V012_1__messaging";
  }

  public String checksum() {
    return "messaging-v1";
  }

  public void apply(MongoTemplate mongo) {
    for (String name :
        new String[] {"conversations", "messages", "conversation_reads", "notifications"}) {
      if (!mongo.collectionExists(name)) mongo.createCollection(name);
    }
    mongo
        .indexOps("conversations")
        .ensureIndex(
            new Index()
                .on("pairKey", Sort.Direction.ASC)
                .unique()
                .partial(
                    PartialIndexFilter.of(new Document("pairKey", new Document("$type", "string"))))
                .named("direct_pair_unique"));
    mongo
        .indexOps("conversations")
        .ensureIndex(
            new Index()
                .on("bookingId", Sort.Direction.ASC)
                .unique()
                .partial(
                    PartialIndexFilter.of(
                        new Document("bookingId", new Document("$type", "string"))))
                .named("booking_conversation_unique"));
    mongo
        .indexOps("conversations")
        .ensureIndex(
            new Index()
                .on("participantIds", Sort.Direction.ASC)
                .on("lastMessageAt", Sort.Direction.DESC)
                .on("_id", Sort.Direction.DESC));
    mongo
        .indexOps("messages")
        .ensureIndex(
            new Index()
                .on("conversationId", Sort.Direction.ASC)
                .on("clientMessageId", Sort.Direction.ASC)
                .unique());
    mongo
        .indexOps("messages")
        .ensureIndex(
            new Index()
                .on("conversationId", Sort.Direction.ASC)
                .on("sequence", Sort.Direction.DESC)
                .unique());
    mongo
        .indexOps("notifications")
        .ensureIndex(new Index().on("userId", Sort.Direction.ASC).on("_id", Sort.Direction.DESC));
  }
}
