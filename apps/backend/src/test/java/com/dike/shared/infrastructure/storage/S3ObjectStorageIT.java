package com.dike.shared.infrastructure.storage;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayInputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.CreateBucketRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Testcontainers(disabledWithoutDocker = true)
class S3ObjectStorageIT {
  @Container
  private static final GenericContainer<?> MINIO =
      new GenericContainer<>(DockerImageName.parse("bitnamilegacy/minio:2025.7.23-debian-12-r5"))
          .withEnv("MINIO_ROOT_USER", "profile-test")
          .withEnv("MINIO_ROOT_PASSWORD", "profile-test-secret")
          .withExposedPorts(9000);

  private static S3Client client;
  private static S3Presigner presigner;
  private static S3ObjectStorage storage;

  @BeforeAll
  static void setup() {
    URI endpoint = URI.create("http://" + MINIO.getHost() + ":" + MINIO.getMappedPort(9000));
    var credentials =
        StaticCredentialsProvider.create(
            AwsBasicCredentials.create("profile-test", "profile-test-secret"));
    var service = S3Configuration.builder().pathStyleAccessEnabled(true).build();
    client =
        S3Client.builder()
            .endpointOverride(endpoint)
            .region(Region.US_EAST_1)
            .credentialsProvider(credentials)
            .serviceConfiguration(service)
            .build();
    presigner =
        S3Presigner.builder()
            .endpointOverride(endpoint)
            .region(Region.US_EAST_1)
            .credentialsProvider(credentials)
            .serviceConfiguration(service)
            .build();
    storage = new S3ObjectStorage(client, presigner);
    client.createBucket(CreateBucketRequest.builder().bucket("profile-private").build());
  }

  @AfterAll
  static void closeClients() {
    if (client != null) client.close();
    if (presigner != null) presigner.close();
  }

  @Test
  void privateObjectNeedsShortLivedSignedUrlAndSupportsMetadataDelete() throws Exception {
    byte[] content = "synthetic-profile-file".getBytes(StandardCharsets.UTF_8);
    storage.put(
        "profile-private",
        "test/object",
        new ByteArrayInputStream(content),
        content.length,
        "application/octet-stream");

    var metadata = storage.head("profile-private", "test/object");
    assertThat(metadata.size()).isEqualTo(content.length);
    URI signed =
        storage.presignGet("profile-private", "test/object", Duration.ofSeconds(5), "document.bin");
    HttpURLConnection connection = (HttpURLConnection) signed.toURL().openConnection();
    assertThat(connection.getResponseCode()).isEqualTo(200);
    assertThat(connection.getInputStream().readAllBytes()).isEqualTo(content);

    storage.delete("profile-private", "test/object");
    assertThatThrownByHead();
  }

  private void assertThatThrownByHead() {
    org.assertj.core.api.Assertions.assertThatThrownBy(
            () -> storage.head("profile-private", "test/object"))
        .isInstanceOf(RuntimeException.class);
  }
}
