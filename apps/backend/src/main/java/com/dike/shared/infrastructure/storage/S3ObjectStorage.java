package com.dike.shared.infrastructure.storage;

import com.dike.shared.application.ObjectStorage;
import java.io.InputStream;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

@Component
class S3ObjectStorage implements ObjectStorage {

  private final S3Client client;

  S3ObjectStorage(S3Client client) {
    this.client = client;
  }

  @Override
  public void put(
      String bucket, String key, InputStream content, long contentLength, String contentType) {
    PutObjectRequest request =
        PutObjectRequest.builder().bucket(bucket).key(key).contentType(contentType).build();
    client.putObject(request, RequestBody.fromInputStream(content, contentLength));
  }

  @Override
  public InputStream get(String bucket, String key) {
    ResponseInputStream<GetObjectResponse> response =
        client.getObject(GetObjectRequest.builder().bucket(bucket).key(key).build());
    return response;
  }
}
