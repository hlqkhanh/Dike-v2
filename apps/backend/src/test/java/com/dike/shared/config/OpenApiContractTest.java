package com.dike.shared.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.core.util.Json;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import org.junit.jupiter.api.Test;

class OpenApiContractTest {

  private final ObjectMapper mapper = Json.mapper();

  @Test
  void reviewedArtifactMatchesBackendMetadataAndFoundationSchemas() throws IOException {
    JsonNode generated = mapper.valueToTree(new OpenApiConfiguration().dikeOpenApi());
    JsonNode reviewed =
        mapper.readTree(Files.readString(findRepositoryRoot().resolve("docs/api/openapi.json")));

    assertThat(reviewed.at("/info/title")).isEqualTo(generated.at("/info/title"));
    assertThat(reviewed.at("/info/version")).isEqualTo(generated.at("/info/version"));
    assertThat(reviewed.at("/servers/0/url")).isEqualTo(generated.at("/servers/0/url"));
    assertThat(reviewed.at("/components/securitySchemes/sessionCookie/name"))
        .isEqualTo(generated.at("/components/securitySchemes/sessionCookie/name"));
    assertThat(reviewed.at("/components/securitySchemes/csrfHeader/name"))
        .isEqualTo(generated.at("/components/securitySchemes/csrfHeader/name"));
    var schemaNames = new HashSet<String>();
    reviewed.at("/components/schemas").fieldNames().forEachRemaining(schemaNames::add);
    assertThat(schemaNames)
        .contains(
            "ErrorResponse",
            "ErrorBody",
            "FieldViolation",
            "AuthSessionResponse",
            "AuthUser",
            "AuthSession",
            "SessionListResponse",
            "PhoneRequest",
            "MyProfileResponse",
            "PrivacyResponse",
            "ConsentSummaryResponse",
            "UploadIntent",
            "FileView",
            "DeletionResponse");
    assertThat(reviewed.at("/paths/~1auth~1session/get/operationId").asText())
        .isEqualTo("getAuthSession");
    assertThat(reviewed.at("/paths/~1me~1profile/get/operationId").asText())
        .isEqualTo("getMyProfile");
    assertThat(reviewed.at("/paths/~1files~1uploads/post/operationId").asText())
        .isEqualTo("createFileUpload");
  }

  private Path findRepositoryRoot() {
    Path current = Path.of("").toAbsolutePath();
    while (current != null) {
      if (Files.exists(current.resolve("pnpm-workspace.yaml"))) return current;
      current = current.getParent();
    }
    throw new IllegalStateException("Cannot locate repository root");
  }
}
