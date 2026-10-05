package com.dike.shared.config;

import com.mongodb.client.MongoClient;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.MongoTransactionManager;
import org.springframework.data.mongodb.core.SimpleMongoClientDatabaseFactory;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(DikeProperties.class)
public class MongoConfiguration {

  @Bean
  MongoTransactionManager mongoTransactionManager(MongoDatabaseFactory databaseFactory) {
    return new MongoTransactionManager(databaseFactory);
  }

  @Bean
  MongoDatabaseFactory mongoDatabaseFactory(
      MongoClient mongoClient,
      org.springframework.boot.mongodb.autoconfigure.MongoProperties properties) {
    return new SimpleMongoClientDatabaseFactory(mongoClient, properties.getDatabase());
  }
}
