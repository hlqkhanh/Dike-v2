package com.dike.identity.application;

import com.dike.identity.domain.UserAccount;
import com.google.i18n.phonenumbers.NumberParseException;
import com.google.i18n.phonenumbers.PhoneNumberUtil;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PhoneOnboardingService {

  private static final Duration VERIFIED_PHONE_REAUTH_MAX_AGE = Duration.ofMinutes(5);

  private final IdentityStore store;
  private final PhoneNumberUtil phoneNumbers;
  private final Clock clock;

  public PhoneOnboardingService(IdentityStore store, Clock clock) {
    this.store = store;
    this.clock = clock;
    this.phoneNumbers = PhoneNumberUtil.getInstance();
  }

  @Transactional
  public UserAccount submit(
      String userId, String input, long expectedPhoneVersion, Instant googleAuthenticatedAt) {
    try {
      var parsed = phoneNumbers.parse(input, "VN");
      if (!phoneNumbers.isValidNumberForRegion(parsed, "VN")) {
        throw new InvalidPhoneException();
      }
      String formatted = phoneNumbers.format(parsed, PhoneNumberUtil.PhoneNumberFormat.E164);
      UserAccount current =
          store
              .findUserById(userId)
              .orElseThrow(() -> new IllegalStateException("Authenticated user does not exist"));
      if (current.phoneVersion() != expectedPhoneVersion) {
        throw new StalePhoneVersionException();
      }
      if (formatted.equals(current.phoneE164())) {
        return current;
      }
      if (current.phoneStatus() == com.dike.identity.domain.PhoneStatus.VERIFIED
          && !recentlyAuthenticated(googleAuthenticatedAt)) {
        throw new ReauthenticationRequiredException();
      }
      return store.updatePhoneCandidate(userId, expectedPhoneVersion, formatted, clock.instant());
    } catch (NumberParseException exception) {
      throw new InvalidPhoneException();
    }
  }

  private boolean recentlyAuthenticated(Instant authenticatedAt) {
    if (authenticatedAt == null) return false;
    Instant now = clock.instant();
    return !authenticatedAt.isAfter(now)
        && !authenticatedAt.isBefore(now.minus(VERIFIED_PHONE_REAUTH_MAX_AGE));
  }

  public static final class InvalidPhoneException extends RuntimeException {

    public InvalidPhoneException() {
      super("Số điện thoại không hợp lệ");
    }
  }

  public static final class ReauthenticationRequiredException extends RuntimeException {

    public ReauthenticationRequiredException() {
      super("Bạn cần đăng nhập lại bằng Google trước khi đổi số đã xác minh");
    }
  }
}
