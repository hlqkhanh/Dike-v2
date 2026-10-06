package com.dike.identity.infrastructure.profile;

import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(ProfileProperties.class)
public class ProfileConfiguration {

  @Bean
  ApplicationRunner validateProfileHostedConfiguration(
      ProfileProperties properties, Environment environment) {
    return arguments -> {
      String current = environment.getProperty("dike.environment", "local");
      if (("production".equals(current) || "staging".equals(current))
          && "basic".equalsIgnoreCase(properties.files().inspector())) {
        throw new IllegalStateException(
            "A production file content scanner is required outside local/test");
      }
      if (("production".equals(current) || "staging".equals(current))
          && !"https".equalsIgnoreCase(properties.files().publicBaseUrl().getScheme())) {
        throw new IllegalStateException(
            "HTTPS public object base URL is required outside local/test");
      }
    };
  }
}
