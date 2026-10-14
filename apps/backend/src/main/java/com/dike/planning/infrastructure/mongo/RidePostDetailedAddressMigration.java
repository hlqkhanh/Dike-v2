package com.dike.planning.infrastructure.mongo;

import com.dike.shared.infrastructure.migration.MongoMigration;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

/** Restores the precise route labels on posts created before detailed addresses were retained. */
@Component
public class RidePostDetailedAddressMigration implements MongoMigration {

  @Override
  public String id() {
    return "V022_1__ride_post_detailed_addresses";
  }

  @Override
  public String checksum() {
    return "ride-post-detailed-addresses-v1";
  }

  @Override
  public void apply(MongoTemplate mongo) {
    if (!mongo.collectionExists("ride_posts") || !mongo.collectionExists("route_snapshots")) return;

    mongo.findAll(Document.class, "ride_posts").stream()
        .filter(post -> post.getString("routeId") != null)
        .forEach(
            post -> {
              Document route =
                  mongo.findById(post.getString("routeId"), Document.class, "route_snapshots");
              if (route == null) return;
              Document origin = route.get("origin", Document.class);
              Document destination = route.get("destination", Document.class);
              if (origin == null || destination == null) return;
              String originLabel = origin.getString("displayLabel");
              String destinationLabel = destination.getString("displayLabel");
              if (originLabel == null || destinationLabel == null) return;

              mongo.updateFirst(
                  Query.query(Criteria.where("_id").is(post.getString("_id"))),
                  new Update()
                      .set("originLabel", originLabel)
                      .set("destinationLabel", destinationLabel),
                  "ride_posts");
            });
  }
}
