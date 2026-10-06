package com.dike.shared.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.bind.Bindable;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.boot.mongodb.autoconfigure.MongoProperties;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mock.env.MockEnvironment;

class MongoPropertiesTest {
  @Test
  void defaultLocalConnectionUsesReplicaSetAndDikeDatabase() throws Exception {
    var environment = new MockEnvironment();
    for (var source :
        new YamlPropertySourceLoader().load("base", new ClassPathResource("application.yml")))
      environment.getPropertySources().addLast(source);
    var properties =
        Binder.get(environment).bind("spring.mongodb", Bindable.of(MongoProperties.class)).get();
    assertThat(properties.getUri()).isEqualTo("mongodb://localhost:27017/dike?replicaSet=rs0");
    assertThat(properties.getDatabase()).isEqualTo("dike");
  }

  @Test
  void configuredDatabaseAndReplicaSetBindInEveryEnvironment() throws Exception {
    for (String resource :
        new String[] {"application.yml", "application-staging.yml", "application-production.yml"}) {
      var environment =
          new MockEnvironment()
              .withProperty(
                  "DIKE_MONGODB_URI", "mongodb://db.example.invalid:27017/synthetic?replicaSet=rs0")
              .withProperty("DIKE_MONGODB_DATABASE", "synthetic");
      for (var source :
          new YamlPropertySourceLoader().load(resource, new ClassPathResource(resource)))
        environment.getPropertySources().addLast(source);
      var properties =
          Binder.get(environment).bind("spring.mongodb", Bindable.of(MongoProperties.class)).get();
      assertThat(properties.getUri())
          .as(resource)
          .isEqualTo("mongodb://db.example.invalid:27017/synthetic?replicaSet=rs0");
      assertThat(properties.getDatabase()).as(resource).isEqualTo("synthetic");
    }
  }
}
