package com.dike.identity.infrastructure.admin;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(AdminBootstrapProperties.class)
class AdminBootstrapConfiguration {

  private static final Logger LOGGER = LoggerFactory.getLogger(AdminBootstrapConfiguration.class);

  @Bean
  @ConditionalOnProperty(name = "dike.admin-bootstrap.enabled", havingValue = "true")
  ApplicationRunner adminBootstrap(
      AdminBootstrapProperties properties, AdminBootstrapService service) {
    return arguments -> {
      requireValue("account-id", properties.accountId());
      requireValue("operator", properties.operator());
      requireValue("reason", properties.reason());
      AdminBootstrapService.Result result =
          service.grant(
              properties.accountId().trim(),
              properties.operator().trim(),
              properties.reason().trim(),
              properties.dryRun());
      LOGGER.info(
          "Admin bootstrap result={} accountId={} operator={} dryRun={}",
          result,
          properties.accountId().trim(),
          properties.operator().trim(),
          properties.dryRun());
    };
  }

  private void requireValue(String name, String value) {
    if (value == null || value.isBlank()) {
      throw new IllegalStateException("Admin bootstrap requires " + name);
    }
  }
}
