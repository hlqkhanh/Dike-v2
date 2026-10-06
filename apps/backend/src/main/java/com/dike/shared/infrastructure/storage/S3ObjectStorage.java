package com.dike.shared.infrastructure.storage;

import com.dike.shared.application.ObjectStorage;
import java.io.InputStream;
import java.net.URI;
import java.time.Duration;
import java.util.Base64;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.CopyObjectRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

@Component
class S3ObjectStorage implements ObjectStorage {

  private final S3Client client;
  private final S3Presigner presigner;

  S3ObjectStorage(S3Client client, S3Presigner presigner) {
    this.client = client;
    this.presigner = presigner;
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

  @Override
  public UploadGrant presignPut(
      String bucket, String key, String contentType, Duration lifetime, String checksumSha256) {
    PutObjectRequest.Builder requestBuilder =
        PutObjectRequest.builder().bucket(bucket).key(key).contentType(contentType);
    if (checksumSha256 != null && !checksumSha256.isBlank()) {
      requestBuilder.checksumSHA256(
          Base64.getEncoder().encodeToString(HexFormat.of().parseHex(checksumSha256)));
    }
    PutObjectRequest request = requestBuilder.build();
    var signed =
        presigner.presignPutObject(
            PutObjectPresignRequest.builder()
                .signatureDuration(lifetime)
                .putObjectRequest(request)
                .build());
    Map<String, String> headers = new LinkedHashMap<>();
    signed
        .signedHeaders()
        .forEach(
            (name, values) -> {
              if (!"host".equalsIgnoreCase(name) && !"content-length".equalsIgnoreCase(name)) {
                headers.put(name, String.join(",", values));
              }
            });
    return new UploadGrant(URI.create(signed.url().toString()), headers);
  }

  @Override
  public URI presignGet(String bucket, String key, Duration lifetime, String downloadName) {
    GetObjectRequest request =
        GetObjectRequest.builder()
            .bucket(bucket)
            .key(key)
            .responseContentDisposition("attachment; filename=\"" + downloadName + "\"")
            .build();
    return URI.create(
        presigner
            .presignGetObject(
                GetObjectPresignRequest.builder()
                    .signatureDuration(lifetime)
                    .getObjectRequest(request)
                    .build())
            .url()
            .toString());
  }

  @Override
  public ObjectMetadata head(String bucket, String key) {
    var response = client.headObject(HeadObjectRequest.builder().bucket(bucket).key(key).build());
    return new ObjectMetadata(response.contentLength(), response.contentType(), response.eTag());
  }

  @Override
  public void copy(String sourceBucket, String sourceKey, String targetBucket, String targetKey) {
    client.copyObject(
        CopyObjectRequest.builder()
            .copySource(sourceBucket + "/" + sourceKey)
            .destinationBucket(targetBucket)
            .destinationKey(targetKey)
            .build());
  }

  @Override
  public void delete(String bucket, String key) {
    client.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key).build());
  }
}
