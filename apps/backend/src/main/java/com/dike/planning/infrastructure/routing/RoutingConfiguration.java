package com.dike.planning.infrastructure.routing;

import java.net.http.HttpClient;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties({RoutingProperties.class, ContributionProperties.class})
public class RoutingConfiguration {

  @Bean("routingRestClient")
  RestClient routingRestClient(RoutingProperties properties) {
    HttpClient client = HttpClient.newBuilder().connectTimeout(properties.connectTimeout()).build();
    var requestFactory = new JdkClientHttpRequestFactory(client);
    requestFactory.setReadTimeout(properties.requestTimeout());
    return RestClient.builder()
        .baseUrl(properties.baseUrl().toString())
        .requestFactory(requestFactory)
        .build();
  }

  @Bean
  ApplicationRunner validateRoutingConfiguration(
      RoutingProperties properties, ContributionProperties contribution, Environment environment) {
    return arguments -> {
      String current = environment.getProperty("dike.environment", "local");
      boolean hosted = "staging".equals(current) || "production".equals(current);
      if (hosted
          && (!"goong".equalsIgnoreCase(properties.provider())
              || properties.apiKey().isBlank()
              || properties.apiKey().contains("not-configured")
              || properties.cacheKeySecret().contains("change-me")
              || !"https".equalsIgnoreCase(properties.baseUrl().getScheme())
              || !"rsapi.goong.io".equalsIgnoreCase(properties.baseUrl().getHost()))) {
        throw new IllegalStateException("Secure Goong routing configuration is required");
      }
      if (hosted && contribution.demo()) {
        throw new IllegalStateException("Hosted contribution policy must not use demo values");
      }
    };
  }
}
