package com.dike.planning.infrastructure;

import com.dike.planning.JourneySources;
import java.util.Optional;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
class MissingJourneyConfiguration {
  @Bean
  @ConditionalOnMissingBean(JourneySources.class)
  JourneySources unavailableJourneys() {
    return new JourneySources() {
      public Optional<Intent> intent(String actor, String id) {
        return Optional.empty();
      }

      public Optional<Route> route(String actor, String id) {
        return Optional.empty();
      }
    };
  }
}
