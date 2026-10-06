package com.dike.shared.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.MongoTransactionManager;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(DikeProperties.class)
public class MongoConfiguration {

  @Bean
  MongoTransactionManager mongoTransactionManager(MongoDatabaseFactory databaseFactory) {
    return new MongoTransactionManager(databaseFactory);
  }
}
