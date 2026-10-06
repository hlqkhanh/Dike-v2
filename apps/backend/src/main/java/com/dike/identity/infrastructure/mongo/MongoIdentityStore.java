package com.dike.identity.infrastructure.mongo;

import com.dike.identity.application.IdentityStore;
import com.dike.identity.application.StalePhoneVersionException;
import com.dike.identity.domain.AuthIdentity;
import com.dike.identity.domain.OnboardingStatus;
import com.dike.identity.domain.PhoneStatus;
import com.dike.identity.domain.UserAccount;
import com.dike.identity.domain.VerificationEvidence;
import java.time.Instant;
import java.util.Optional;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;

@Repository
class MongoIdentityStore implements IdentityStore {

  private final MongoTemplate template;

  MongoIdentityStore(MongoTemplate template) {
    this.template = template;
  }

  @Override
  public Optional<AuthIdentity> findIdentity(String issuer, String subject) {
    Query query = Query.query(Criteria.where("issuer").is(issuer).and("subject").is(subject));
    return Optional.ofNullable(template.findOne(query, AuthIdentityDocument.class)).map(this::map);
  }

  @Override
  public Optional<UserAccount> findUserById(String userId) {
    return Optional.ofNullable(template.findById(userId, UserDocument.class)).map(this::map);
  }

  @Override
  public Optional<UserAccount> findUserByCanonicalEmail(String canonicalEmail) {
    Query query = Query.query(Criteria.where("canonicalEmail").is(canonicalEmail));
    return Optional.ofNullable(template.findOne(query, UserDocument.class)).map(this::map);
  }

  @Override
  public UserAccount insertUser(UserAccount user) {
    return map(template.insert(map(user)));
  }

  @Override
  public void insertIdentity(AuthIdentity identity) {
    template.insert(map(identity));
  }

  @Override
  public void updateIdentityLogin(String identityId, Instant lastLoginAt, String emailSnapshot) {
    template.updateFirst(
        Query.query(Criteria.where("_id").is(identityId)),
        new Update().set("lastLoginAt", lastLoginAt).set("emailSnapshot", emailSnapshot),
        AuthIdentityDocument.class);
  }

  @Override
  public UserAccount updatePhoneCandidate(
      String userId, long expectedPhoneVersion, String phoneE164, Instant updatedAt) {
    UserDocument updated =
        template.findAndModify(
            Query.query(
                Criteria.where("_id").is(userId).and("phoneVersion").is(expectedPhoneVersion)),
            new Update()
                .set("phoneE164", phoneE164)
                .set("phoneStatus", PhoneStatus.UNVERIFIED)
                .set("verificationEvidence", VerificationEvidence.NONE)
                .unset("phoneVerifiedAt")
                .set("onboardingStatus", OnboardingStatus.PHONE_SUBMITTED)
                .set("updatedAt", updatedAt)
                .inc("phoneVersion", 1)
                .inc("authorizationVersion", 1),
            FindAndModifyOptions.options().returnNew(true),
            UserDocument.class);
    if (updated == null) {
      throw new StalePhoneVersionException();
    }
    return map(updated);
  }

  private UserAccount map(UserDocument document) {
    return new UserAccount(
        document.id(),
        document.canonicalEmail(),
        document.displayName(),
        document.avatarUrl(),
        document.accountStatus() == null
            ? com.dike.identity.domain.AccountStatus.ACTIVE
            : document.accountStatus(),
        document.onboardingStatus() == null
            ? OnboardingStatus.PHONE_REQUIRED
            : document.onboardingStatus(),
        document.phoneE164(),
        document.phoneStatus() == null ? PhoneStatus.NOT_PROVIDED : document.phoneStatus(),
        document.phoneVersion() == null ? 0 : document.phoneVersion(),
        document.phoneVerifiedAt(),
        document.verificationEvidence() == null
            ? VerificationEvidence.NONE
            : document.verificationEvidence(),
        document.assignedRoles() == null ? java.util.Set.of() : document.assignedRoles(),
        document.authorizationVersion() == null ? 0 : document.authorizationVersion(),
        document.createdAt(),
        document.updatedAt(),
        document.version() == null ? 0 : document.version());
  }

  private UserDocument map(UserAccount user) {
    return new UserDocument(
        user.id(),
        user.canonicalEmail(),
        user.displayName(),
        user.avatarUrl(),
        user.accountStatus(),
        user.onboardingStatus(),
        user.phoneE164(),
        user.phoneStatus(),
        user.phoneVersion(),
        user.phoneVerifiedAt(),
        user.verificationEvidence(),
        user.assignedRoles(),
        user.authorizationVersion(),
        user.createdAt(),
        user.updatedAt(),
        user.version());
  }

  private AuthIdentity map(AuthIdentityDocument document) {
    return new AuthIdentity(
        document.id(),
        document.provider(),
        document.issuer(),
        document.subject(),
        document.userId(),
        document.emailSnapshot(),
        document.emailVerified(),
        document.createdAt(),
        document.lastLoginAt());
  }

  private AuthIdentityDocument map(AuthIdentity identity) {
    return new AuthIdentityDocument(
        identity.id(),
        identity.provider(),
        identity.issuer(),
        identity.subject(),
        identity.userId(),
        identity.emailSnapshot(),
        identity.emailVerified(),
        identity.createdAt(),
        identity.lastLoginAt());
  }
}
