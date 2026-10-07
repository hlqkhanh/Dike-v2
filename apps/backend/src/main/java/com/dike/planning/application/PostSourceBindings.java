package com.dike.planning.application;

import java.time.Instant;

/** Bind existing immutable route evidence inside the caller's transaction. */
public interface PostSourceBindings {
  String create(String actor, String routeId, Instant departure, Instant arrival);

  void bind(String actor, String id, long version, String routeId);
}
