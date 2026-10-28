package com.dike.shared.infrastructure.storage;

import com.dike.shared.config.DikeProperties;
import org.springframework.boot.health.contributor.Health;
import org.springframework.boot.health.contributor.HealthIndicator;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.HeadBucketRequest;

@Component("objectStorage")
@Profile("!demo")
class ObjectStorageHealthIndicator implements HealthIndicator {

  private final S3Client client;
  private final DikeProperties properties;

  ObjectStorageHealthIndicator(S3Client client, DikeProperties properties) {
    this.client = client;
    this.properties = properties;
  }

  @Override
  public Health health() {
    try {
      client.headBucket(
          HeadBucketRequest.builder().bucket(properties.storage().privateBucket()).build());
      return Health.up().build();
    } catch (RuntimeException exception) {
      return Health.down().withDetail("reason", exception.getClass().getSimpleName()).build();
    }
  }
}
