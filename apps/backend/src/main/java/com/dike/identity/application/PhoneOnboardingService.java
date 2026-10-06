package com.dike.identity.application;

import com.dike.identity.domain.UserAccount;
import com.google.i18n.phonenumbers.NumberParseException;
import com.google.i18n.phonenumbers.PhoneNumberUtil;
import java.time.Clock;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PhoneOnboardingService {

  private final IdentityStore store;
  private final PhoneNumberUtil phoneNumbers;
  private final Clock clock;

  public PhoneOnboardingService(IdentityStore store, Clock clock) {
    this.store = store;
    this.clock = clock;
    this.phoneNumbers = PhoneNumberUtil.getInstance();
  }

  @Transactional
  public UserAccount submit(String userId, String input) {
    try {
      var parsed = phoneNumbers.parse(input, "VN");
      if (!phoneNumbers.isValidNumberForRegion(parsed, "VN")) {
        throw new InvalidPhoneException();
      }
      String formatted = phoneNumbers.format(parsed, PhoneNumberUtil.PhoneNumberFormat.E164);
      return store.updatePhoneCandidate(userId, formatted, clock.instant());
    } catch (NumberParseException exception) {
      throw new InvalidPhoneException();
    }
  }

  public static final class InvalidPhoneException extends RuntimeException {

    public InvalidPhoneException() {
      super("Số điện thoại không hợp lệ");
    }
  }
}
