package com.dike.planning.infrastructure;

import com.dike.planning.application.PostStore;
import com.dike.planning.domain.RidePost;
import com.dike.shared.application.AtomicCommands;
import com.dike.shared.outbox.OutboxPublisher;
import java.time.Clock;
import java.util.Map;
import org.springframework.context.annotation.Profile;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@Profile("worker | combined")
class PostExpiryWorker {
  private final MongoTemplate mongo;
  private final PostStore store;
  private final AtomicCommands commands;
  private final OutboxPublisher events;
  private final Clock clock;

  PostExpiryWorker(
      MongoTemplate mongo,
      PostStore store,
      AtomicCommands commands,
      OutboxPublisher events,
      Clock clock) {
    this.mongo = mongo;
    this.store = store;
    this.commands = commands;
    this.events = events;
    this.clock = clock;
  }

  @Scheduled(fixedDelayString = "${dike.posts.expiry-interval:30s}")
  void expire() {
    for (var row :
        mongo.find(
            Query.query(Criteria.where("status").is("OPEN").and("expiresAt").lte(clock.instant()))
                .limit(100),
            RidePost.class,
            "ride_posts"))
      commands.transaction(
          () -> {
            var p = store.find(row.id()).orElseThrow();
            commands.fence("intent", p.sourceId());
            if (p.status() == RidePost.Status.OPEN && !p.live(clock.instant())) {
              var next = p.change(RidePost.Status.EXPIRED, "TIME", clock.instant());
              store.save(p, next);
              events.publish(
                  "post.closed",
                  "RidePost",
                  p.id(),
                  1,
                  Map.of("postId", p.id(), "version", next.version()));
            }
            return null;
          });
  }
}
