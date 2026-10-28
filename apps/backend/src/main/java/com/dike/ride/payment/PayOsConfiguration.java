package com.dike.ride.payment;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import vn.payos.PayOS;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(PayOsProperties.class)
class PayOsConfiguration {
  @Bean(destroyMethod = "close")
  PayOS payOs(PayOsProperties properties) {
    return properties.configured()
        ? new PayOS(properties.clientId(), properties.apiKey(), properties.checksumKey())
        : new PayOS("disabled", "disabled", "disabled");
  }
}
