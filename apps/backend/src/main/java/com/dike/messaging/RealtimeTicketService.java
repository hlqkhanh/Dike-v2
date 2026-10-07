package com.dike.messaging;

import com.dike.identity.IdentityAccess;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.Principal;
import java.security.SecureRandom;
import java.time.Clock;
import java.util.Base64;
import java.util.HexFormat;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Service
class RealtimeTicketService {

  private static final SecureRandom RANDOM = new SecureRandom();
  private final StringRedisTemplate redis;
  private final RealtimeProperties properties;
  private final Clock clock;
  private final IdentityAccess identities;

  RealtimeTicketService(
      StringRedisTemplate redis,
      RealtimeProperties properties,
      Clock clock,
      IdentityAccess identities) {
    this.redis = redis;
    this.properties = properties;
    this.clock = clock;
    this.identities = identities;
  }

  RealtimeTicket issue(String userId) {
    var access = identities.require(userId);
    if (access.locked()) throw new IllegalArgumentException("ACCOUNT_LOCKED");
    byte[] value = new byte[32];
    RANDOM.nextBytes(value);
    String ticket = Base64.getUrlEncoder().withoutPadding().encodeToString(value);
    redis
        .opsForValue()
        .set(key(ticket), userId + ":" + access.authorizationVersion(), properties.ticketTtl());
    return new RealtimeTicket(
        ticket, properties.websocketUrl(), clock.instant().plus(properties.ticketTtl()));
  }

  TicketPrincipal consume(String ticket) {
    if (ticket == null || ticket.length() < 32 || ticket.length() > 128) {
      throw new IllegalArgumentException("REALTIME_TICKET_INVALID");
    }
    String value = redis.opsForValue().getAndDelete(key(ticket));
    if (value == null) {
      throw new IllegalArgumentException("REALTIME_TICKET_INVALID");
    }
    int separator = value.lastIndexOf(':');
    if (separator <= 0) {
      throw new IllegalStateException("Malformed realtime ticket payload");
    }
    return new TicketPrincipal(
        value.substring(0, separator), Long.parseLong(value.substring(separator + 1)));
  }

  private String key(String ticket) {
    try {
      byte[] digest =
          MessageDigest.getInstance("SHA-256").digest(ticket.getBytes(StandardCharsets.UTF_8));
      return properties.redisChannel() + ":ticket:" + HexFormat.of().formatHex(digest);
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 is unavailable", exception);
    }
  }

  record TicketPrincipal(String userId, long authorizationVersion) implements Principal {
    public String getName() {
      return userId;
    }
  }
}
