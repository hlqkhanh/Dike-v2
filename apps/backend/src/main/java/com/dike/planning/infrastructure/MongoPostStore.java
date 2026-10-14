package com.dike.planning.infrastructure;

import com.dike.planning.application.PostStore;
import com.dike.planning.domain.RidePost;
import com.mongodb.ReadPreference;
import java.util.List;
import java.util.Optional;
import org.bson.Document;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.stereotype.Repository;

@Repository
public class MongoPostStore implements PostStore {
  private final MongoTemplate mongo;

  public MongoPostStore(MongoTemplate mongo) {
    this.mongo = mongo;
  }

  public Optional<RidePost> find(String id) {
    return Optional.ofNullable(
        mongo.findOne(
            Query.query(Criteria.where("_id").is(id)).withReadPreference(ReadPreference.primary()),
            RidePost.class,
            "ride_posts"));
  }

  public List<RidePost> scan(String after, int limit, String owner) {
    Criteria c = new Criteria();
    if (after != null) {
      var anchor = find(after);
      if (anchor.isEmpty()) return List.of();
      var date = anchor.get().publishedAt();
      c =
          date == null
              ? Criteria.where("publishedAt").is(null).and("_id").lt(after)
              : new Criteria()
                  .orOperator(
                      Criteria.where("publishedAt").lt(date),
                      Criteria.where("publishedAt").is(null),
                      Criteria.where("publishedAt").is(date).and("_id").lt(after));
    }
    if (owner != null) c = c.and("ownerId").is(owner);
    return mongo.find(
        Query.query(c)
            .with(Sort.by(Sort.Direction.DESC, "publishedAt", "_id"))
            .limit(limit)
            .withReadPreference(ReadPreference.primary()),
        RidePost.class,
        "ride_posts");
  }

  public void insert(RidePost post) {
    mongo.insert(post, "ride_posts");
  }

  public void save(RidePost before, RidePost after) {
    if (mongo
            .replace(
                Query.query(
                    Criteria.where("_id").is(before.id()).and("version").is(before.version())),
                after,
                "ride_posts")
            .getModifiedCount()
        != 1) throw new OptimisticLockingFailureException("Post changed");
  }

  public List<RidePost> bySource(String source) {
    return mongo.find(
        Query.query(Criteria.where("sourceId").is(source)), RidePost.class, "ride_posts");
  }

  public void saveFor(String viewer, String post, boolean saved) {
    String id = viewer.length() + ":" + viewer + post;
    Query q = Query.query(Criteria.where("_id").is(id));
    if (saved) mongo.upsert(q, new Update().set("viewer", viewer).set("post", post), "saved_posts");
    else mongo.remove(q, "saved_posts");
  }

  public List<String> saved(String viewer, String after, int limit) {
    Criteria c = Criteria.where("viewer").is(viewer);
    if (after != null) c = c.and("post").gt(after);
    return mongo
        .find(Query.query(c).with(Sort.by("post")).limit(limit), Document.class, "saved_posts")
        .stream()
        .map(d -> d.getString("post"))
        .toList();
  }

  public long pendingResponseCount(String postId) {
    return mongo.count(
        Query.query(Criteria.where("postId").is(postId).and("status").is("PENDING")),
        "ride_post_responses");
  }
}
