package com.dike.identity;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.URI;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.MessageDigest;
import java.security.Signature;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.bson.Document;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.DEFINED_PORT)
class GoogleOidcSessionIT {

  private static final ObjectMapper JSON = new ObjectMapper();
  private static final Base64.Encoder BASE64 = Base64.getUrlEncoder().withoutPadding();
  private static final int APP_PORT = freePort();
  private static final MockOidcServer OIDC = MockOidcServer.start();

  @Container
  private static final MongoDBContainer MONGO =
      new MongoDBContainer(DockerImageName.parse("mongo:8.0.32-noble"));

  @Container
  private static final GenericContainer<?> REDIS =
      new GenericContainer<>(DockerImageName.parse("redis:8.10.2-alpine3.23"))
          .withExposedPorts(6379);

  @Autowired private MongoTemplate mongo;

  @DynamicPropertySource
  static void properties(DynamicPropertyRegistry registry) {
    String app = "http://localhost:" + APP_PORT;
    registry.add("server.port", () -> APP_PORT);
    registry.add("dike.environment", () -> "test");
    registry.add("dike.auth.public-base-url", () -> app);
    registry.add("dike.auth.allowed-origins", () -> app);
    registry.add("dike.auth.google.issuer", OIDC::issuer);
    registry.add("spring.data.mongodb.uri", MONGO::getReplicaSetUrl);
    registry.add("spring.data.mongodb.database", () -> "dike_stage2_oidc_test");
    registry.add("spring.data.redis.host", REDIS::getHost);
    registry.add("spring.data.redis.port", () -> REDIS.getMappedPort(6379));
    registry.add("spring.security.oauth2.client.registration.google.client-id", () -> "dike-test");
    registry.add(
        "spring.security.oauth2.client.registration.google.client-secret", () -> "test-secret");
    registry.add("spring.security.oauth2.client.registration.google.provider", () -> "mock");
    registry.add(
        "spring.security.oauth2.client.provider.mock.authorization-uri", OIDC::authorizeUri);
    registry.add("spring.security.oauth2.client.provider.mock.token-uri", OIDC::tokenUri);
    registry.add("spring.security.oauth2.client.provider.mock.jwk-set-uri", OIDC::jwksUri);
    registry.add("spring.security.oauth2.client.provider.mock.user-info-uri", OIDC::userInfoUri);
    registry.add("spring.security.oauth2.client.provider.mock.user-name-attribute", () -> "sub");
  }

  @AfterAll
  static void stopOidc() {
    OIDC.stop();
  }

  @Test
  void completesPkceLoginPersistsIdentityAndUsesRedisBackedSession() throws Exception {
    CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
    HttpClient browser =
        HttpClient.newBuilder()
            .cookieHandler(cookies)
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();
    String app = "http://localhost:" + APP_PORT;

    HttpResponse<String> start = get(browser, app + "/api/v1/auth/google");
    assertThat(start.statusCode()).isEqualTo(302);

    HttpResponse<String> authorization =
        get(browser, app + start.headers().firstValue("location").orElseThrow());
    assertThat(authorization.statusCode()).isEqualTo(302);
    URI providerLocation = URI.create(authorization.headers().firstValue("location").orElseThrow());
    assertThat(providerLocation.getQuery()).contains("code_challenge_method=S256");

    HttpResponse<String> provider = get(browser, providerLocation.toString());
    assertThat(provider.statusCode()).isEqualTo(302);
    HttpResponse<String> callback =
        get(browser, provider.headers().firstValue("location").orElseThrow());
    assertThat(callback.statusCode()).isEqualTo(302);
    assertThat(callback.headers().firstValue("location").orElseThrow())
        .isEqualTo(app + "/auth/complete");
    assertThat(OIDC.pkceVerified()).isTrue();

    HttpResponse<String> session = get(browser, app + "/api/v1/auth/session");
    assertThat(session.statusCode()).isEqualTo(200);
    assertThat(session.headers().firstValue("cache-control")).contains("no-store");
    JsonNode sessionBody = JSON.readTree(session.body());
    assertThat(sessionBody.at("/user/email").asText()).isEqualTo("rider@example.test");
    assertThat(sessionBody.at("/user/nextAction").asText()).isEqualTo("SUBMIT_PHONE");

    String csrf =
        cookies.getCookieStore().getCookies().stream()
            .filter(cookie -> cookie.getName().equals("XSRF-TOKEN"))
            .findFirst()
            .orElseThrow()
            .getValue();
    HttpRequest phoneRequest =
        HttpRequest.newBuilder(URI.create(app + "/api/v1/auth/phone"))
            .header("Origin", app)
            .header("Content-Type", "application/json")
            .header("X-XSRF-TOKEN", URLDecoder.decode(csrf, StandardCharsets.UTF_8))
            .PUT(HttpRequest.BodyPublishers.ofString("{\"phoneNumber\":\"0901234567\"}"))
            .build();
    HttpResponse<String> phone = browser.send(phoneRequest, HttpResponse.BodyHandlers.ofString());
    assertThat(phone.statusCode()).isEqualTo(200);
    assertThat(JSON.readTree(phone.body()).at("/user/phoneStatus").asText())
        .isEqualTo("UNVERIFIED");

    assertThat(mongo.getCollection("users").countDocuments()).isEqualTo(1);
    assertThat(mongo.getCollection("auth_identities").countDocuments()).isEqualTo(1);
    Document identity = mongo.getCollection("auth_identities").find().first();
    assertThat(identity).isNotNull();
    assertThat(identity.keySet())
        .doesNotContain("accessToken", "refreshToken", "idToken", "authorizationCode");
  }

  private static HttpResponse<String> get(HttpClient client, String uri)
      throws IOException, InterruptedException {
    return client.send(
        HttpRequest.newBuilder(URI.create(uri)).GET().build(),
        HttpResponse.BodyHandlers.ofString());
  }

  private static int freePort() {
    try (ServerSocket socket = new ServerSocket(0)) {
      return socket.getLocalPort();
    } catch (IOException exception) {
      throw new IllegalStateException(exception);
    }
  }

  private static final class MockOidcServer {

    private final HttpServer server;
    private final KeyPair keys;
    private final AtomicReference<String> nonce = new AtomicReference<>();
    private final AtomicReference<String> challenge = new AtomicReference<>();
    private final AtomicReference<Boolean> pkceVerified = new AtomicReference<>(false);

    private MockOidcServer(HttpServer server, KeyPair keys) {
      this.server = server;
      this.keys = keys;
    }

    static MockOidcServer start() {
      try {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        MockOidcServer oidc =
            new MockOidcServer(
                HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0),
                generator.generateKeyPair());
        oidc.server.createContext("/authorize", oidc::authorize);
        oidc.server.createContext("/token", oidc::token);
        oidc.server.createContext("/jwks", oidc::jwks);
        oidc.server.createContext("/userinfo", oidc::userInfo);
        oidc.server.start();
        return oidc;
      } catch (Exception exception) {
        throw new IllegalStateException(exception);
      }
    }

    String issuer() {
      return "http://127.0.0.1:" + server.getAddress().getPort();
    }

    String authorizeUri() {
      return issuer() + "/authorize";
    }

    String tokenUri() {
      return issuer() + "/token";
    }

    String jwksUri() {
      return issuer() + "/jwks";
    }

    String userInfoUri() {
      return issuer() + "/userinfo";
    }

    boolean pkceVerified() {
      return pkceVerified.get();
    }

    void stop() {
      server.stop(0);
    }

    private void authorize(HttpExchange exchange) throws IOException {
      Map<String, String> query = form(exchange.getRequestURI().getRawQuery());
      nonce.set(query.get("nonce"));
      challenge.set(query.get("code_challenge"));
      String callback =
          query.get("redirect_uri")
              + "?code=test-code&state="
              + URLEncoder.encode(query.get("state"), StandardCharsets.UTF_8);
      exchange.getResponseHeaders().add("Location", callback);
      exchange.sendResponseHeaders(302, -1);
      exchange.close();
    }

    private void token(HttpExchange exchange) throws IOException {
      String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
      Map<String, String> values = form(body);
      String verifier = values.get("code_verifier");
      String actual =
          BASE64.encodeToString(
              digest(verifier == null ? "" : verifier, StandardCharsets.US_ASCII));
      pkceVerified.set(actual.equals(challenge.get()));
      Instant now = Instant.now();
      Map<String, Object> claims = new LinkedHashMap<>();
      claims.put("iss", issuer());
      claims.put("sub", "google-subject-1");
      claims.put("aud", "dike-test");
      claims.put("iat", now.getEpochSecond());
      claims.put("exp", now.plusSeconds(300).getEpochSecond());
      claims.put("nonce", nonce.get());
      claims.put("email", "rider@example.test");
      claims.put("email_verified", true);
      claims.put("name", "Test Rider");
      respondJson(
          exchange,
          Map.of(
              "access_token",
              "provider-access-token",
              "token_type",
              "Bearer",
              "expires_in",
              300,
              "id_token",
              jwt(claims)));
    }

    private void jwks(HttpExchange exchange) throws IOException {
      RSAPublicKey publicKey = (RSAPublicKey) keys.getPublic();
      respondJson(
          exchange,
          Map.of(
              "keys",
              java.util.List.of(
                  Map.of(
                      "kty", "RSA",
                      "kid", "stage2-test-key",
                      "alg", "RS256",
                      "use", "sig",
                      "n", unsigned(publicKey.getModulus().toByteArray()),
                      "e", unsigned(publicKey.getPublicExponent().toByteArray())))));
    }

    private void userInfo(HttpExchange exchange) throws IOException {
      respondJson(
          exchange,
          Map.of(
              "sub", "google-subject-1",
              "email", "rider@example.test",
              "email_verified", true,
              "name", "Test Rider"));
    }

    private String jwt(Map<String, Object> claims) {
      try {
        String header =
            BASE64.encodeToString(
                JSON.writeValueAsBytes(
                    Map.of("alg", "RS256", "typ", "JWT", "kid", "stage2-test-key")));
        String payload = BASE64.encodeToString(JSON.writeValueAsBytes(claims));
        String content = header + "." + payload;
        Signature signer = Signature.getInstance("SHA256withRSA");
        signer.initSign(keys.getPrivate());
        signer.update(content.getBytes(StandardCharsets.US_ASCII));
        return content + "." + BASE64.encodeToString(signer.sign());
      } catch (Exception exception) {
        throw new IllegalStateException(exception);
      }
    }

    private static String unsigned(byte[] bytes) {
      int offset = bytes.length > 1 && bytes[0] == 0 ? 1 : 0;
      return BASE64.encodeToString(java.util.Arrays.copyOfRange(bytes, offset, bytes.length));
    }

    private static byte[] digest(String value, java.nio.charset.Charset charset) {
      try {
        return MessageDigest.getInstance("SHA-256").digest(value.getBytes(charset));
      } catch (Exception exception) {
        throw new IllegalStateException(exception);
      }
    }

    private static Map<String, String> form(String encoded) {
      Map<String, String> result = new LinkedHashMap<>();
      if (encoded == null || encoded.isBlank()) return result;
      for (String pair : encoded.split("&")) {
        String[] parts = pair.split("=", 2);
        result.put(
            URLDecoder.decode(parts[0], StandardCharsets.UTF_8),
            URLDecoder.decode(parts.length == 2 ? parts[1] : "", StandardCharsets.UTF_8));
      }
      return result;
    }

    private static void respondJson(HttpExchange exchange, Object body) throws IOException {
      byte[] bytes = JSON.writeValueAsBytes(body);
      exchange.getResponseHeaders().add("Content-Type", "application/json");
      exchange.sendResponseHeaders(200, bytes.length);
      exchange.getResponseBody().write(bytes);
      exchange.close();
    }
  }
}
