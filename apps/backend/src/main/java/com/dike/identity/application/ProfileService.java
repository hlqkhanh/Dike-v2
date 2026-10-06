package com.dike.identity.application;

import com.dike.identity.domain.AccountStatus;
import com.dike.identity.domain.ProfileVisibility;
import com.dike.identity.domain.UserAccount;
import com.dike.identity.domain.UserPrivacySettings;
import com.dike.identity.domain.UserProfile;
import java.text.Normalizer;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProfileService {

  private final ProfileDataStore store;
  private final IdentityStore identities;
  private final AccountAccessService access;
  private final Clock clock;

  public ProfileService(
      ProfileDataStore store, IdentityStore identities, AccountAccessService access, Clock clock) {
    this.store = store;
    this.identities = identities;
    this.access = access;
    this.clock = clock;
  }

  @Transactional
  public ProfileBundle me(String userId) {
    return new ProfileBundle(requireProfile(userId), requirePrivacy(userId));
  }

  public PublicProfile view(String viewerId, String userId) {
    access.require(viewerId);
    UserAccount account = identities.findUserById(userId).orElseThrow(NotVisibleException::new);
    if (account.accountStatus() != AccountStatus.ACTIVE) throw new NotVisibleException();
    UserPrivacySettings privacy = requirePrivacy(userId);
    boolean admin = access.require(viewerId).authorities().contains(AccountAuthority.ADMIN);
    if (!viewerId.equals(userId)
        && !admin
        && privacy.profileVisibility() == ProfileVisibility.PRIVATE) {
      throw new NotVisibleException();
    }
    return publicView(requireProfile(userId), account);
  }

  public List<PublicProfile> search(String viewerId, String query, String cursor, int limit) {
    access.require(viewerId);
    String normalized = normalizeName(query);
    if (normalized.codePointCount(0, normalized.length()) < 2) return List.of();
    return store.searchProfiles(normalized, cursor, Math.min(Math.max(limit, 1), 20)).stream()
        .filter(
            profile ->
                store
                    .findPrivacy(profile.userId())
                    .map(UserPrivacySettings::discoverableByName)
                    .orElse(false))
        .filter(
            profile ->
                store
                    .findPrivacy(profile.userId())
                    .map(p -> p.profileVisibility() == ProfileVisibility.MEMBERS)
                    .orElse(false))
        .map(
            profile ->
                identities
                    .findUserById(profile.userId())
                    .filter(account -> account.accountStatus() == AccountStatus.ACTIVE)
                    .map(account -> publicView(profile, account))
                    .orElse(null))
        .filter(java.util.Objects::nonNull)
        .toList();
  }

  public UserProfile updateProfile(
      String userId, String displayName, String bio, long expectedVersion) {
    String safeName = validateDisplayName(displayName);
    String safeBio = validateBio(bio);
    requireProfile(userId);
    return store
        .updateProfile(
            userId, expectedVersion, safeName, normalizeName(safeName), safeBio, clock.instant())
        .orElseThrow(VersionConflictException::new);
  }

  public UserPrivacySettings updatePrivacy(
      String userId,
      ProfileVisibility visibility,
      boolean discoverable,
      boolean allowMessages,
      long expectedVersion) {
    requirePrivacy(userId);
    return store
        .updatePrivacy(
            userId, expectedVersion, visibility, discoverable, allowMessages, clock.instant())
        .orElseThrow(PrivacyVersionConflictException::new);
  }

  private UserProfile requireProfile(String userId) {
    return store.findProfile(userId).orElseGet(() -> initializeProfile(userId));
  }

  private UserPrivacySettings requirePrivacy(String userId) {
    return store.findPrivacy(userId).orElseGet(() -> initializePrivacy(userId));
  }

  private UserProfile initializeProfile(String userId) {
    UserAccount account = identities.findUserById(userId).orElseThrow(NotFoundException::new);
    Instant now = clock.instant();
    String name = validateDisplayName(account.displayName());
    return store.saveInitialProfile(
        new UserProfile(
            userId, name, normalizeName(name), "", null, account.avatarUrl(), now, now, 0));
  }

  private UserPrivacySettings initializePrivacy(String userId) {
    if (identities.findUserById(userId).isEmpty()) throw new NotFoundException();
    return store.saveInitialPrivacy(
        new UserPrivacySettings(userId, ProfileVisibility.MEMBERS, true, true, clock.instant(), 0));
  }

  private PublicProfile publicView(UserProfile profile, UserAccount account) {
    return new PublicProfile(
        profile.userId(),
        profile.displayName(),
        profile.bio(),
        profile.avatarPublicUrl(),
        account.phoneStatus().name().equals("VERIFIED"));
  }

  static String normalizeName(String value) {
    return Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFKC)
        .strip()
        .replaceAll("\\s+", " ")
        .toLowerCase(Locale.ROOT);
  }

  static String validateDisplayName(String value) {
    String clean =
        Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFKC)
            .strip()
            .replaceAll("\\s+", " ");
    int size = clean.codePointCount(0, clean.length());
    if (size < 2 || size > 80 || containsUnsafeControl(clean)) throw new InvalidProfileException();
    return clean;
  }

  static String validateBio(String value) {
    String clean = (value == null ? "" : value).replace("\r\n", "\n").replace('\r', '\n').strip();
    if (clean.codePointCount(0, clean.length()) > 300
        || containsUnsafeControl(clean.replace("\n", ""))) {
      throw new InvalidProfileException();
    }
    return clean;
  }

  private static boolean containsUnsafeControl(String value) {
    return value
        .codePoints()
        .anyMatch(
            c ->
                Character.isISOControl(c)
                    || c == 0x202A
                    || c == 0x202B
                    || c == 0x202D
                    || c == 0x202E
                    || c == 0x2066
                    || c == 0x2067
                    || c == 0x2068
                    || c == 0x2069);
  }

  public record ProfileBundle(UserProfile profile, UserPrivacySettings privacy) {}

  public record PublicProfile(
      String userId, String displayName, String bio, String avatarUrl, boolean verified) {}

  public static final class NotFoundException extends RuntimeException {}

  public static final class NotVisibleException extends RuntimeException {}

  public static final class VersionConflictException extends RuntimeException {}

  public static final class PrivacyVersionConflictException extends RuntimeException {}

  public static final class InvalidProfileException extends RuntimeException {}
}
