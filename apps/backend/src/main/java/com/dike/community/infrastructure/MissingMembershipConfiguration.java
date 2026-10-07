package com.dike.community.infrastructure;

import com.dike.community.CommunityAccess;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
class MissingMembershipConfiguration {
  @Bean
  @ConditionalOnMissingBean(CommunityAccess.class)
  CommunityAccess unavailableMembership() {
    return (user, community) -> false;
  }
}
