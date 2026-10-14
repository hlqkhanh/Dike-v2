package com.dike.identity.application;

import com.dike.community.SocialAccessPolicy;
import com.dike.community.SocialPrivacyChanges;
import com.dike.identity.domain.AccountStatus;
import com.dike.identity.domain.ProfileVisibility;
import com.dike.identity.domain.UserAccount;
import com.dike.identity.domain.UserPrivacySettings;
import com.dike.identity.domain.UserProfile;
import java.text.Normalizer;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProfileService {

  private static final Map<String, String> VIETNAM_PROVINCES =
      Map.ofEntries(
          Map.entry("ha-noi", "Hà Nội"), Map.entry("hue", "Huế"),
          Map.entry("lai-chau", "Lai Châu"), Map.entry("dien-bien", "Điện Biên"),
          Map.entry("son-la", "Sơn La"), Map.entry("lang-son", "Lạng Sơn"),
          Map.entry("cao-bang", "Cao Bằng"), Map.entry("tuyen-quang", "Tuyên Quang"),
          Map.entry("lao-cai", "Lào Cai"), Map.entry("thai-nguyen", "Thái Nguyên"),
          Map.entry("phu-tho", "Phú Thọ"), Map.entry("bac-ninh", "Bắc Ninh"),
          Map.entry("hung-yen", "Hưng Yên"), Map.entry("hai-phong", "Hải Phòng"),
          Map.entry("ninh-binh", "Ninh Bình"), Map.entry("quang-ninh", "Quảng Ninh"),
          Map.entry("thanh-hoa", "Thanh Hóa"), Map.entry("nghe-an", "Nghệ An"),
          Map.entry("ha-tinh", "Hà Tĩnh"), Map.entry("quang-tri", "Quảng Trị"),
          Map.entry("da-nang", "Đà Nẵng"), Map.entry("quang-ngai", "Quảng Ngãi"),
          Map.entry("gia-lai", "Gia Lai"), Map.entry("khanh-hoa", "Khánh Hòa"),
          Map.entry("lam-dong", "Lâm Đồng"), Map.entry("dak-lak", "Đắk Lắk"),
          Map.entry("ho-chi-minh", "Thành phố Hồ Chí Minh"), Map.entry("dong-nai", "Đồng Nai"),
          Map.entry("tay-ninh", "Tây Ninh"), Map.entry("can-tho", "Cần Thơ"),
          Map.entry("vinh-long", "Vĩnh Long"), Map.entry("dong-thap", "Đồng Tháp"),
          Map.entry("ca-mau", "Cà Mau"), Map.entry("an-giang", "An Giang"));

  private final ProfileDataStore store;
  private final IdentityStore identities;
  private final AccountAccessService access;
  private final Clock clock;
  private final SocialAccessPolicy social;
  private final SocialPrivacyChanges socialPrivacy;

  public ProfileService(
      ProfileDataStore store,
      IdentityStore identities,
      AccountAccessService access,
      Clock clock,
      SocialAccessPolicy social,
      SocialPrivacyChanges socialPrivacy) {
    this.store = store;
    this.identities = identities;
    this.access = access;
    this.clock = clock;
    this.social = social;
    this.socialPrivacy = socialPrivacy;
  }

  @Transactional
  public ProfileBundle me(String userId) {
    return new ProfileBundle(
        requireProfile(userId),
        requirePrivacy(userId),
        identities.findUserById(userId).orElseThrow(NotFoundException::new));
  }

  public PublicProfile view(String viewerId, String userId) {
    access.require(viewerId);
    if (social.blocked(viewerId, userId)) throw new NotVisibleException();
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
        .filter(profile -> !social.blocked(viewerId, profile.userId()))
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
      String userId,
      String displayName,
      String bio,
      LocalDate dateOfBirth,
      String provinceCode,
      String localityCode,
      String localityName,
      String facebookUrl,
      long expectedVersion) {
    String safeName = validateDisplayName(displayName);
    String safeBio = validateBio(bio);
    LocalDate safeBirthDate = validateBirthDate(dateOfBirth);
    String safeProvinceCode = optional(provinceCode, 40);
    String provinceName = safeProvinceCode.isEmpty() ? "" : VIETNAM_PROVINCES.get(safeProvinceCode);
    if (!safeProvinceCode.isEmpty() && provinceName == null) throw new InvalidProfileException();
    String safeLocalityCode = optional(localityCode, 80);
    if (safeProvinceCode.isEmpty() && !safeLocalityCode.isEmpty())
      throw new InvalidProfileException();
    String safeLocalityName = safeLocalityCode.isEmpty() ? "" : optional(localityName, 160);
    if (!safeLocalityCode.isEmpty() && safeLocalityName.isEmpty())
      throw new InvalidProfileException();
    String safeFacebookUrl = validateFacebookUrl(facebookUrl);
    requireProfile(userId);
    return store
        .updateProfile(
            userId,
            expectedVersion,
            safeName,
            normalizeName(safeName),
            safeBio,
            safeBirthDate,
            safeProvinceCode,
            provinceName,
            safeLocalityCode,
            safeLocalityName,
            safeFacebookUrl,
            clock.instant())
        .orElseThrow(VersionConflictException::new);
  }

  @Transactional
  public UserPrivacySettings updatePrivacy(
      String userId,
      ProfileVisibility visibility,
      boolean discoverable,
      boolean allowMessages,
      long expectedVersion) {
    requirePrivacy(userId);
    var updated =
        store
            .updatePrivacy(
                userId, expectedVersion, visibility, discoverable, allowMessages, clock.instant())
            .orElseThrow(PrivacyVersionConflictException::new);
    socialPrivacy.invalidateProfiles();
    return updated;
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
            userId,
            name,
            normalizeName(name),
            "",
            null,
            "",
            "",
            "",
            "",
            "",
            null,
            account.avatarUrl(),
            now,
            now,
            0));
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

  private LocalDate validateBirthDate(LocalDate value) {
    if (value == null) return null;
    LocalDate today = LocalDate.now(clock);
    if (value.isAfter(today) || value.isBefore(today.minusYears(120))) {
      throw new InvalidProfileException();
    }
    return value;
  }

  private static String optional(String value, int maxLength) {
    String clean = value == null ? "" : value.strip();
    if (clean.length() > maxLength || containsUnsafeControl(clean))
      throw new InvalidProfileException();
    return clean;
  }

  private static String validateFacebookUrl(String value) {
    String clean = optional(value, 300);
    if (clean.isEmpty()) return clean;
    try {
      var uri = java.net.URI.create(clean);
      String host = uri.getHost();
      if (!"https".equalsIgnoreCase(uri.getScheme())
          || host == null
          || !(host.equalsIgnoreCase("facebook.com")
              || host.toLowerCase(Locale.ROOT).endsWith(".facebook.com"))) {
        throw new InvalidProfileException();
      }
      return uri.toString();
    } catch (IllegalArgumentException exception) {
      throw new InvalidProfileException();
    }
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

  public record ProfileBundle(
      UserProfile profile, UserPrivacySettings privacy, UserAccount account) {}

  public record PublicProfile(
      String userId, String displayName, String bio, String avatarUrl, boolean verified) {}

  public static final class NotFoundException extends RuntimeException {}

  public static final class NotVisibleException extends RuntimeException {}

  public static final class VersionConflictException extends RuntimeException {}

  public static final class PrivacyVersionConflictException extends RuntimeException {}

  public static final class InvalidProfileException extends RuntimeException {}
}
