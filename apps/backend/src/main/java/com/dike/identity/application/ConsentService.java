package com.dike.identity.application;

import com.dike.identity.domain.ConsentDecision;
import com.dike.identity.domain.ConsentReceipt;
import com.dike.identity.domain.ConsentType;
import com.dike.identity.infrastructure.profile.ProfileProperties;
import java.time.Clock;
import java.util.List;
import java.util.function.Supplier;
import org.slf4j.MDC;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ConsentService {

  private final ProfileDataStore store;
  private final ProfileProperties properties;
  private final Clock clock;
  private final Supplier<String> ids;

  public ConsentService(
      ProfileDataStore store, ProfileProperties properties, Clock clock, Supplier<String> ids) {
    this.store = store;
    this.properties = properties;
    this.clock = clock;
    this.ids = ids;
  }

  public ConsentSummary summary(String userId) {
    return new ConsentSummary(requirements(userId), store.findConsents(userId));
  }

  @Transactional
  public ConsentReceipt decide(
      String userId, ConsentType type, ConsentDecision decision, String locale) {
    if (decision == ConsentDecision.WITHDRAWN) throw new UnsupportedWithdrawalException();
    String version = currentVersion(type);
    var existing = store.findConsent(userId, type, version, decision);
    if (existing.isPresent()) return existing.get();
    ConsentReceipt receipt =
        new ConsentReceipt(
            ids.get(),
            userId,
            type,
            version,
            decision,
            clock.instant(),
            "WEB",
            safeLocale(locale),
            MDC.get("correlationId"),
            null);
    try {
      return store.insertConsent(receipt);
    } catch (DuplicateKeyException exception) {
      return store.findConsent(userId, type, version, decision).orElseThrow(() -> exception);
    }
  }

  public boolean hasRequiredConsents(String userId) {
    return requirements(userId).stream().allMatch(Requirement::accepted);
  }

  private List<Requirement> requirements(String userId) {
    return List.of(
        requirement(
            userId,
            ConsentType.TERMS,
            properties.documents().termsVersion(),
            properties.documents().termsUrl().toString()),
        requirement(
            userId,
            ConsentType.PRIVACY_NOTICE,
            properties.documents().privacyVersion(),
            properties.documents().privacyUrl().toString()),
        requirement(
            userId, ConsentType.AGE_18_ATTESTATION, properties.documents().ageVersion(), null));
  }

  private Requirement requirement(String userId, ConsentType type, String version, String url) {
    boolean accepted =
        store.findConsent(userId, type, version, ConsentDecision.ACCEPTED).isPresent();
    boolean withdrawn =
        store.findConsent(userId, type, version, ConsentDecision.WITHDRAWN).isPresent();
    return new Requirement(type, version, url, accepted && !withdrawn);
  }

  private String currentVersion(ConsentType type) {
    return switch (type) {
      case TERMS -> properties.documents().termsVersion();
      case PRIVACY_NOTICE -> properties.documents().privacyVersion();
      case AGE_18_ATTESTATION -> properties.documents().ageVersion();
    };
  }

  private String safeLocale(String value) {
    return value != null && value.matches("[a-zA-Z]{2,8}(-[a-zA-Z0-9]{1,8})*") ? value : "vi";
  }

  public record Requirement(
      ConsentType type, String version, String documentUrl, boolean accepted) {}

  public record ConsentSummary(List<Requirement> requirements, List<ConsentReceipt> receipts) {
    public ConsentSummary {
      requirements = List.copyOf(requirements);
      receipts = List.copyOf(receipts);
    }
  }

  public static final class UnsupportedWithdrawalException extends RuntimeException {}
}
