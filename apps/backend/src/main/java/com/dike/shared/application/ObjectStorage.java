package com.dike.shared.application;

import java.io.InputStream;

public interface ObjectStorage {

  void put(String bucket, String key, InputStream content, long contentLength, String contentType);

  InputStream get(String bucket, String key);
}
