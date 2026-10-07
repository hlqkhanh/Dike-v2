package com.dike.ride.infrastructure;

import com.dike.ride.application.BoardingSecrets;
import com.dike.shared.api.ApiException;
import com.dike.shared.application.AtomicCommands;
import java.security.*;
import java.time.*;
import java.util.*;
import javax.crypto.Cipher;
import javax.crypto.spec.*;
import org.bson.Document;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class MongoBoardingSecrets implements BoardingSecrets {
  private final MongoTemplate mongo;
  private final AtomicCommands commands;
  private final Clock clock;
  private final String configuredKey;
  private final SecureRandom random = new SecureRandom();

  public MongoBoardingSecrets(
      MongoTemplate mongo,
      AtomicCommands commands,
      Clock clock,
      @Value("${dike.ride.boarding-key:}") String key) {
    this.mongo = mongo;
    this.commands = commands;
    this.clock = clock;
    this.configuredKey = key;
  }

  private SecretKeySpec key() {
    try {
      byte[] bytes = Base64.getDecoder().decode(configuredKey);
      if (bytes.length != 32) throw new IllegalArgumentException();
      return new SecretKeySpec(bytes, "AES");
    } catch (IllegalArgumentException invalid) {
      throw new ApiException(
          HttpStatus.SERVICE_UNAVAILABLE, "BOARDING_KEY_UNAVAILABLE", "Chưa cấu hình mã lên xe");
    }
  }

  public void create(String booking) {
    String code = String.format(Locale.ROOT, "%06d", random.nextInt(1_000_000));
    byte[] iv = new byte[12];
    random.nextBytes(iv);
    mongo.insert(
        new Document("_id", booking)
            .append("iv", Base64.getEncoder().encodeToString(iv))
            .append("ciphertext", crypt(Cipher.ENCRYPT_MODE, booking, code, iv))
            .append("attempts", 0)
            .append("windowAt", Date.from(clock.instant()))
            .append("consumed", false),
        "boarding_secrets");
  }

  public String reveal(String booking) {
    var doc = read(booking);
    if (doc.getBoolean("consumed", false)) throw unavailable();
    return decrypt(booking, doc);
  }

  public boolean attempt(String booking, String code) {
    return commands.transaction(
        () -> {
          var doc = read(booking);
          if (doc.getBoolean("consumed", false)) throw unavailable();
          Instant now = clock.instant();
          boolean reset = !now.isBefore(doc.getDate("windowAt").toInstant().plusSeconds(900));
          int attempts = reset ? 0 : doc.getInteger("attempts");
          if (attempts >= 5)
            throw new ApiException(
                HttpStatus.TOO_MANY_REQUESTS,
                "BOARDING_RATE_LIMITED",
                "Vui lòng thử lại sau",
                Duration.ofMinutes(15));
          mongo.updateFirst(
              Query.query(Criteria.where("_id").is(booking)),
              new Update()
                  .set("attempts", attempts + 1)
                  .set("windowAt", reset ? Date.from(now) : doc.getDate("windowAt")),
              "boarding_secrets");
          return code != null
              && code.matches("[0-9]{6}")
              && MessageDigest.isEqual(
                  code.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                  decrypt(booking, doc).getBytes(java.nio.charset.StandardCharsets.UTF_8));
        });
  }

  public void consume(String booking) {
    if (mongo
            .updateFirst(
                Query.query(Criteria.where("_id").is(booking).and("consumed").is(false)),
                new Update().set("consumed", true).unset("ciphertext"),
                "boarding_secrets")
            .getModifiedCount()
        != 1) throw unavailable();
  }

  private Document read(String booking) {
    var doc = mongo.findById(booking, Document.class, "boarding_secrets");
    if (doc == null) throw unavailable();
    return doc;
  }

  private String decrypt(String booking, Document doc) {
    return crypt(
        Cipher.DECRYPT_MODE,
        booking,
        doc.getString("ciphertext"),
        Base64.getDecoder().decode(doc.getString("iv")));
  }

  private String crypt(int mode, String booking, String value, byte[] iv) {
    try {
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(mode, key(), new GCMParameterSpec(128, iv));
      cipher.updateAAD(booking.getBytes(java.nio.charset.StandardCharsets.UTF_8));
      byte[] input =
          mode == Cipher.ENCRYPT_MODE
              ? value.getBytes(java.nio.charset.StandardCharsets.UTF_8)
              : Base64.getDecoder().decode(value);
      byte[] output = cipher.doFinal(input);
      return mode == Cipher.ENCRYPT_MODE
          ? Base64.getEncoder().encodeToString(output)
          : new String(output, java.nio.charset.StandardCharsets.UTF_8);
    } catch (ApiException e) {
      throw e;
    } catch (Exception e) {
      throw new IllegalStateException("Boarding secret operation failed");
    }
  }

  private ApiException unavailable() {
    return new ApiException(
        HttpStatus.CONFLICT, "BOARDING_UNAVAILABLE", "Mã lên xe không còn hiệu lực");
  }
}
