package com.dike;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.time.*;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

class DemoDataServiceTest {
  final MongoTemplate mongo = mock(MongoTemplate.class);
  final DemoDataService service =
      new DemoDataService(
          mongo, Clock.fixed(Instant.parse("2026-10-14T00:00:00Z"), ZoneOffset.UTC));

  @Test
  void startupOnlyRetiresKnownLegacyDemoPostsInsteadOfSeedingRealAccounts() {
    service.run(mock(ApplicationArguments.class));
    var query = ArgumentCaptor.forClass(Query.class);
    var update = ArgumentCaptor.forClass(Update.class);
    verify(mongo).updateMulti(query.capture(), update.capture(), eq("ride_posts"));
    assertThat(query.getValue().getQueryObject().get("_id").toString())
        .isEqualTo("^demo:[^:]+:post-offer$");
    assertThat(update.getValue().getUpdateObject().get("$set", Document.class).getString("status"))
        .isEqualTo("CLOSED");
    verifyNoMoreInteractions(mongo);
  }

  @Test
  void explicitDemoSeedOnlyCreatesSharedSamplePostsAndNeverRefreshesExistingPosts() {
    var summary = service.seedFor("real-user");
    var updates = ArgumentCaptor.forClass(Update.class);
    verify(mongo, times(4)).upsert(any(Query.class), updates.capture(), eq("ride_posts"));
    for (var update : updates.getAllValues()) {
      var insert = update.getUpdateObject().get("$setOnInsert", Document.class);
      assertThat(insert.getString("ownerId")).startsWith("demo-user-");
      assertThat(insert).containsKeys("origin", "destination", "publishedAt");
      assertThat(update.getUpdateObject()).doesNotContainKey("$set");
    }
    verify(mongo, never()).save(any(), eq("ride_posts"));
    assertThat(summary.posts()).isEqualTo(4);
  }
}
