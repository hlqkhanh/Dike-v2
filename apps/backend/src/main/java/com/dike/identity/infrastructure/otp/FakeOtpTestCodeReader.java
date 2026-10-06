package com.dike.identity.infrastructure.otp;

import com.dike.identity.application.OtpTestCodeReader;
import java.util.Optional;
import org.bson.Document;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "dike.otp", name = "provider", havingValue = "fake")
final class FakeOtpTestCodeReader implements OtpTestCodeReader {

  private final MongoTemplate mongo;
  private final FakeOtpProvider provider;

  FakeOtpTestCodeReader(MongoTemplate mongo, FakeOtpProvider provider) {
    this.mongo = mongo;
    this.provider = provider;
  }

  @Override
  public Optional<String> read(String userId, String deviceSessionId, String challengeId) {
    Document challenge =
        mongo.findOne(
            Query.query(
                Criteria.where("_id")
                    .is(challengeId)
                    .and("userId")
                    .is(userId)
                    .and("deviceSessionId")
                    .is(deviceSessionId)),
            Document.class,
            "otp_challenges");
    if (challenge == null) return Optional.empty();
    return provider.codeFor(challenge.getString("dispatchId"));
  }
}
