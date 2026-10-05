package com.dike.shared.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import io.swagger.v3.core.util.Json;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.MOCK,
    properties = {
      "dike.migrations.enabled=false",
      "spring.profiles.active=api",
      "dike.environment=test",
      "spring.mongodb.uri=mongodb://localhost:27017/dike_contract?serverSelectionTimeoutMS=100",
      "DIKE_GOOGLE_CLIENT_ID=",
      "DIKE_GOOGLE_CLIENT_SECRET="
    })
class RuntimeContractTest {
  @org.springframework.beans.factory.annotation.Autowired
  org.springframework.web.context.WebApplicationContext context;

  @Test
  void exportedRuntimeContractMatchesReviewedArtifact() throws Exception {
    var response =
        org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup(context)
            .build()
            .perform(
                org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(
                    "/api/openapi.json"))
            .andReturn()
            .getResponse();
    assertThat(response.getStatus()).isEqualTo(200);
    JsonNode generated = Json.mapper().readTree(response.getContentAsString());
    Path current = Path.of("").toAbsolutePath();
    while (current != null && !Files.exists(current.resolve("pnpm-workspace.yaml")))
      current = current.getParent();
    if (current == null) throw new IllegalStateException("Repository not found");
    Path path = current.resolve("docs/api/openapi.json");
    if (Boolean.getBoolean("dike.contract.write"))
      Files.writeString(path, Json.pretty(generated) + "\n");
    assertThat(Json.mapper().readTree(Files.readString(path))).isEqualTo(generated);
  }
}
