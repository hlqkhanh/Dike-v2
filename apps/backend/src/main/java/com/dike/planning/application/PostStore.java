package com.dike.planning.application;

import com.dike.planning.domain.RidePost;
import java.util.List;
import java.util.Optional;

public interface PostStore {
  Optional<RidePost> find(String id);

  List<RidePost> scan(String after, int limit, String owner);

  void insert(RidePost post);

  void save(RidePost before, RidePost after);

  List<RidePost> bySource(String source);

  void saveFor(String viewer, String post, boolean saved);

  List<String> saved(String viewer, String after, int limit);
}
