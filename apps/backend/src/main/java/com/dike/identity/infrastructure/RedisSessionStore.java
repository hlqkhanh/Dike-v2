package com.dike.identity.infrastructure;

import com.dike.identity.application.SessionStore;
import com.dike.shared.api.ApiException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Clock;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Repository;

@Repository
public class RedisSessionStore implements SessionStore {
  private static final String PREFIX = "dike:auth:v1:";
  private final StringRedisTemplate redis;
  private final Clock clock;
  private final SecureRandom random = new SecureRandom();

  public RedisSessionStore(StringRedisTemplate redis, Clock clock) {
    this.redis = redis;
    this.clock = clock;
  }

  private String secret() {
    byte[] value = new byte[32];
    random.nextBytes(value);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(value);
  }

  private String hash(String value) {
    try {
      return java.util.HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (java.security.NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }
  }

  private String credentialKey(String credential) {
    if (credential == null || !credential.matches("[A-Za-z0-9_-]{43}")) throw unauthorized();
    return PREFIX + "credential:" + hash(credential);
  }

  private ApiException unauthorized() {
    return new ApiException(HttpStatus.UNAUTHORIZED, "SESSION_REQUIRED", "Please sign in again");
  }

  private String execute(String script, List<String> keys, String... args) {
    return redis.execute(new DefaultRedisScript<>(script, String.class), keys, (Object[]) args);
  }

  private Session decode(String value) {
    if (value == null || value.isBlank()) throw unauthorized();
    String[] fields = value.split("\\|");
    return new Session(
        fields[0],
        fields[1],
        Long.parseLong(fields[2]),
        Long.parseLong(fields[3]),
        Long.parseLong(fields[4]),
        Long.parseLong(fields[5]),
        fields[6]);
  }

  private static final String VIEW =
      "return redis.call('HGET',k,'id')..'|'..redis.call('HGET',k,'user')..'|'..redis.call('HGET',k,'version')..'|'..redis.call('HGET',k,'issued')..'|'..redis.call('HGET',k,'seen')..'|'..redis.call('HGET',k,'expires')..'|'..redis.call('HGET',k,'csrf')";

  public Issued create(String userId, long version) {
    String credential = secret(), csrf = secret(), id = UUID.randomUUID().toString();
    long now = clock.instant().getEpochSecond(), expires = now + 604800;
    String value =
        execute(
            """
     local active = redis.call('SMEMBERS', KEYS[1])
     local count = 0
     for _,key in ipairs(active) do
       if redis.call('EXISTS',key)==1 then count=count+1 else redis.call('SREM',KEYS[1],key) end
     end
     if count >= 5 then return 'LIMIT' end
     local k=KEYS[2]
     redis.call('HSET',k,'id',ARGV[1],'user',ARGV[2],'version',ARGV[3],'issued',ARGV[4],'seen',ARGV[4],'expires',ARGV[5],'csrf',ARGV[6],'credential',KEYS[3])
     redis.call('EXPIRE',k,1800)
     redis.call('SET',KEYS[3],k,'EX',1800)
     redis.call('SADD',KEYS[1],k)
     redis.call('EXPIRE',KEYS[1],604800)
     """
                + VIEW,
            List.of(PREFIX + "user:" + userId, PREFIX + "device:" + id, credentialKey(credential)),
            id,
            userId,
            Long.toString(version),
            Long.toString(now),
            Long.toString(expires),
            csrf);
    if ("LIMIT".equals(value))
      throw new ApiException(
          HttpStatus.CONFLICT,
          "SESSION_LIMIT",
          "Revoke a session on an existing device before signing in");
    return new Issued(credential, decode(value));
  }

  public Session read(String credential) {
    String value =
        execute(
            """
     local k=redis.call('GET',KEYS[1])
     if not k or redis.call('EXISTS',k)==0 then return '' end
     local remaining=tonumber(redis.call('HGET',k,'expires'))-tonumber(ARGV[1])
     if remaining<=0 then redis.call('DEL',k,KEYS[1]); return '' end
     redis.call('HSET',k,'seen',ARGV[1])
     redis.call('EXPIRE',k,math.min(remaining,1800))
     redis.call('EXPIRE',KEYS[1],math.min(remaining,1800))
     """
                + VIEW,
            List.of(credentialKey(credential)),
            Long.toString(clock.instant().getEpochSecond()));
    return decode(value);
  }

  public Issued rotate(String credential, String csrf) {
    String next = secret(), nextCsrf = secret();
    String value =
        execute(
            """
     local k=redis.call('GET',KEYS[1])
     if not k or redis.call('EXISTS',k)==0 then return '' end
     if redis.call('HGET',k,'csrf')~=ARGV[1] then return '' end
     local remaining=tonumber(redis.call('HGET',k,'expires'))-tonumber(ARGV[3])
     if remaining<=0 then redis.call('DEL',k,KEYS[1]); return '' end
     redis.call('DEL',KEYS[1])
     redis.call('SET',KEYS[2],k,'EX',math.min(remaining,1800))
     redis.call('HSET',k,'credential',KEYS[2],'csrf',ARGV[2],'seen',ARGV[3])
     redis.call('EXPIRE',k,math.min(remaining,1800))
     """
                + VIEW,
            List.of(credentialKey(credential), credentialKey(next)),
            csrf,
            nextCsrf,
            Long.toString(clock.instant().getEpochSecond()));
    return new Issued(next, decode(value));
  }

  public void revoke(String userId, String deviceId) {
    String result =
        execute(
            """
     local k=KEYS[1]
     if redis.call('HGET',k,'user')~=ARGV[1] then return '' end
     local credential=redis.call('HGET',k,'credential')
     redis.call('DEL',credential,k)
     redis.call('SREM',KEYS[2],k)
     return 'OK'
     """,
            List.of(PREFIX + "device:" + deviceId, PREFIX + "user:" + userId),
            userId);
    if (!"OK".equals(result))
      throw new ApiException(HttpStatus.NOT_FOUND, "SESSION_NOT_FOUND", "Session unavailable");
  }

  public List<Session> list(String userId) {
    List<Session> result = new ArrayList<>();
    var keys = redis.opsForSet().members(PREFIX + "user:" + userId);
    if (keys == null) return result;
    for (String key : keys) {
      String value =
          execute(
              "local k=KEYS[1]; if redis.call('EXISTS',k)==0 then return '' end; " + VIEW,
              List.of(key));
      if (value != null && !value.isBlank()) result.add(decode(value));
    }
    return result;
  }

  public void rateLimit(String key, int maximum) {
    Long count =
        redis.execute(
            new DefaultRedisScript<>(
                "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n",
                Long.class),
            List.of(PREFIX + "rate:" + hash(key)));
    if (count == null || count > maximum)
      throw new ApiException(
          HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED", "Please wait before retrying");
  }
}
