package com.dike.shared.config;

import com.dike.shared.application.StorageLocations;
import java.time.Duration;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.client.config.ClientOverrideConfiguration;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.BucketLifecycleConfiguration;
import software.amazon.awssdk.services.s3.model.ExpirationStatus;
import software.amazon.awssdk.services.s3.model.LifecycleExpiration;
import software.amazon.awssdk.services.s3.model.LifecycleRule;
import software.amazon.awssdk.services.s3.model.LifecycleRuleFilter;
import software.amazon.awssdk.services.s3.model.PutBucketLifecycleConfigurationRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Configuration(proxyBeanMethods = false)
public class StorageConfiguration {

  @Bean
  StorageLocations storageLocations(DikeProperties properties) {
    return new StorageLocations(
        properties.environment(),
        properties.storage().publicBucket(),
        properties.storage().privateBucket());
  }

  @Bean
  S3Client s3Client(DikeProperties properties) {
    DikeProperties.Storage storage = properties.storage();
    Duration timeout = storage.timeout();
    return S3Client.builder()
        .endpointOverride(storage.endpoint())
        .region(Region.of(storage.region()))
        .credentialsProvider(
            StaticCredentialsProvider.create(
                AwsBasicCredentials.create(storage.accessKey(), storage.secretKey())))
        .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build())
        .overrideConfiguration(
            ClientOverrideConfiguration.builder()
                .apiCallTimeout(timeout)
                .apiCallAttemptTimeout(timeout)
                .build())
        .build();
  }

  @Bean
  S3Presigner s3Presigner(DikeProperties properties) {
    DikeProperties.Storage storage = properties.storage();
    return S3Presigner.builder()
        .endpointOverride(storage.endpoint())
        .region(Region.of(storage.region()))
        .credentialsProvider(
            StaticCredentialsProvider.create(
                AwsBasicCredentials.create(storage.accessKey(), storage.secretKey())))
        .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build())
        .build();
  }

  @Bean
  ApplicationRunner configureLocalStoragePolicies(S3Client client, DikeProperties properties) {
    return arguments -> {
      if (!"local".equals(properties.environment())
          || !("api".equals(properties.workload()) || "combined".equals(properties.workload()))) {
        return;
      }
      LifecycleRule cleanup =
          LifecycleRule.builder()
              .id("dike-staging-cleanup")
              .status(ExpirationStatus.ENABLED)
              .filter(
                  LifecycleRuleFilter.builder()
                      .prefix(properties.environment() + "/staging/")
                      .build())
              .expiration(LifecycleExpiration.builder().days(2).build())
              .build();
      client.putBucketLifecycleConfiguration(
          PutBucketLifecycleConfigurationRequest.builder()
              .bucket(properties.storage().privateBucket())
              .lifecycleConfiguration(BucketLifecycleConfiguration.builder().rules(cleanup).build())
              .build());
    };
  }
}
