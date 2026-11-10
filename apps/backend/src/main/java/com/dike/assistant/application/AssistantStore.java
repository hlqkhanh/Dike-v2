package com.dike.assistant.application;

public interface AssistantStore {
  String read(String actor, String id);

  void save(String actor, String id, String value);

  void delete(String actor, String id);

  boolean lock(String actor, String id, String token);

  void unlock(String actor, String id, String token);

  void acquire(String actor);

  void acquireAi();
}
