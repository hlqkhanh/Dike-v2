package com.dike.identity.application;

import java.util.Optional;

public interface OtpTestCodeReader {

  Optional<String> read(String userId, String deviceSessionId, String challengeId);
}
