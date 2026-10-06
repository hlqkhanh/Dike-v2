package com.dike.community.application;

import com.dike.community.domain.SocialRelation;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.function.Supplier;

public interface SocialStore {
  <T> T transaction(Supplier<T> work);

  Optional<SocialRelation> pair(String a, String b);

  Optional<SocialRelation> invitation(String requestId);

  void save(SocialRelation before, SocialRelation after, String actor, String action);

  List<SocialRelation> list(String actor, String kind, String after, int limit);

  Optional<String> receipt(String actor, String key);

  void receipt(String actor, String key, String fingerprint, String relationId, Instant now);

  void acquireSendQuota(String actor, Instant now);

  long revision(String actor);

  void purgeUser(String actor);

  void invalidateProfiles();
}
