package com.dike.shared.application;

import java.io.InputStream;
import java.net.URI;
import java.time.Duration;
import java.util.Map;

public interface ObjectStorage {

  void put(String bucket, String key, InputStream content, long contentLength, String contentType);

  InputStream get(String bucket, String key);

  UploadGrant presignPut(
      String bucket, String key, String contentType, Duration lifetime, String checksumSha256);

  URI presignGet(String bucket, String key, Duration lifetime, String downloadName);

  ObjectMetadata head(String bucket, String key);

  void copy(String sourceBucket, String sourceKey, String targetBucket, String targetKey);

  void delete(String bucket, String key);

  record UploadGrant(URI url, Map<String, String> requiredHeaders) {
    public UploadGrant {
      requiredHeaders = Map.copyOf(requiredHeaders);
    }
  }

  record ObjectMetadata(long size, String contentType, String etag) {}
}
