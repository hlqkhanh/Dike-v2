package com.dike.identity.infrastructure;

import static org.junit.jupiter.api.Assertions.*;

import com.dike.shared.api.ApiException;
import java.time.Clock;
import java.util.concurrent.Executors;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
class RedisSessionIT {
  @Container
  static GenericContainer<?> redis =
      new GenericContainer<>("redis:8.10.2-alpine3.23").withExposedPorts(6379);

  @Test
  void newVersionCanLoginWhenLogoutAllCleanupWasInterrupted() {
    var connection = new LettuceConnectionFactory(redis.getHost(), redis.getMappedPort(6379));
    connection.afterPropertiesSet();
    try {
      var store = new RedisSessionStore(new StringRedisTemplate(connection), Clock.systemUTC());
      var first = store.create("cleanup-user", 0);
      for (int i = 1; i < 5; i++) store.create("cleanup-user", 0);
      assertThrows(ApiException.class, () -> store.create("cleanup-user", 0));
      var current = store.create("cleanup-user", 1);
      assertEquals(1, store.list("cleanup-user").size());
      assertEquals(current.session().deviceId(), store.read(current.credential()).deviceId());
      assertThrows(ApiException.class, () -> store.read(first.credential()));
      assertThrows(
          ApiException.class, () -> store.revoke("other-user", current.session().deviceId()));
      assertEquals(current.session().deviceId(), store.read(current.credential()).deviceId());
    } finally {
      connection.destroy();
    }
  }

  @Test
  void twoInstancesCannotRotateOrResurrectRevokedCredential() throws Exception {
    var connection = new LettuceConnectionFactory(redis.getHost(), redis.getMappedPort(6379));
    connection.afterPropertiesSet();
    try {
      var template = new StringRedisTemplate(connection);
      var a = new RedisSessionStore(template, Clock.systemUTC());
      var b = new RedisSessionStore(template, Clock.systemUTC());
      var issued = a.create("synthetic-user", 0);
      try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
        var first =
            executor.submit(
                () -> {
                  try {
                    return a.rotate(issued.credential(), issued.session().csrf());
                  } catch (ApiException e) {
                    return null;
                  }
                });
        var second =
            executor.submit(
                () -> {
                  try {
                    return b.rotate(issued.credential(), issued.session().csrf());
                  } catch (ApiException e) {
                    return null;
                  }
                });
        var x = first.get();
        var y = second.get();
        assertTrue((x == null) != (y == null));
        var winner = x == null ? y : x;
        assertThrows(ApiException.class, () -> a.read(issued.credential()));
        b.revoke("synthetic-user", winner.session().deviceId());
        assertThrows(
            ApiException.class, () -> a.rotate(winner.credential(), winner.session().csrf()));
        assertThrows(ApiException.class, () -> a.read(winner.credential()));
      }
    } finally {
      connection.destroy();
    }
  }
}
