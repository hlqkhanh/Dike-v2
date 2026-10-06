package com.dike.identity.application;

import com.dike.identity.domain.FilePurpose;

public interface FileContentInspector {
  Inspection inspect(FilePurpose purpose, String declaredContentType, byte[] content);

  record Inspection(String detectedContentType, byte[] safeContent, String outputExtension) {}
}
