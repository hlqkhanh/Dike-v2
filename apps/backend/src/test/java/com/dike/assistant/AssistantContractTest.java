package com.dike.assistant;

import static org.assertj.core.api.Assertions.assertThat;

import com.dike.assistant.api.AssistantController;
import com.dike.assistant.application.AssistantService;
import com.dike.planning.AssistantPlanning;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.swagger.v3.core.converter.ModelConverters;
import io.swagger.v3.core.util.Json;
import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.Test;

/** Export only this feature's reviewed schemas without needing a live MongoDB server. */
class AssistantContractTest {
  @Test
  void assistantContractMatchesRuntimeTypes() throws Exception {
    Path root = Path.of("").toAbsolutePath();
    while (!Files.exists(root.resolve("pnpm-workspace.yaml"))) root = root.getParent();
    Path file = root.resolve("docs/api/openapi.json");
    ObjectMapper json = Json.mapper();
    ObjectNode contract = (ObjectNode) json.readTree(Files.readString(file));
    ObjectNode schemas = (ObjectNode) contract.path("components").path("schemas");
    ObjectNode paths = (ObjectNode) contract.path("paths");
    boolean update = Boolean.getBoolean("updateAssistantContract");
    // Resolve the complete graph before comparing: referenced schemas may be revisited
    // with different nullable metadata while traversing another record.
    Map<String, com.fasterxml.jackson.databind.JsonNode> expectedSchemas = new TreeMap<>();
    for (Class<?> type :
        List.of(
            AssistantService.Conversation.class,
            AssistantService.Reply.class,
            AssistantService.Confirmation.class,
            AssistantController.Message.class,
            AssistantPlanning.Result.class)) {
      ModelConverters.getInstance()
          .readAll(type)
          .forEach((name, schema) -> expectedSchemas.put(name, json.valueToTree(schema)));
    }
    expectedSchemas.forEach(
        (name, expected) -> {
          if (update) schemas.set(name, expected);
          else assertThat(schemas.get(name)).as(name).isEqualTo(expected);
        });
    add(
        paths,
        json,
        update,
        "/assistant/conversations",
        "post",
        "createAssistantConversation",
        null,
        "AssistantConversation");
    add(
        paths,
        json,
        update,
        "/assistant/conversations/{id}",
        "get",
        "getAssistantConversation",
        null,
        "AssistantConversation");
    add(
        paths,
        json,
        update,
        "/assistant/conversations/{id}",
        "delete",
        "deleteAssistantConversation",
        null,
        null);
    add(
        paths,
        json,
        update,
        "/assistant/conversations/{id}/messages",
        "post",
        "sendAssistantMessage",
        "AssistantMessageInput",
        "AssistantReply");
    add(
        paths,
        json,
        update,
        "/assistant/conversations/{id}/confirm",
        "post",
        "confirmAssistantDraft",
        "AssistantConfirmation",
        "AssistantConfirmationResult");
    if (update)
      Files.writeString(
          file, json.writerWithDefaultPrettyPrinter().writeValueAsString(contract) + "\n");
  }

  private void add(
      ObjectNode paths,
      ObjectMapper json,
      boolean update,
      String path,
      String method,
      String operation,
      String input,
      String output) {
    ObjectNode value = json.createObjectNode();
    value.put("operationId", operation);
    value.putArray("tags").add("assistant");
    value.putArray("security").addObject().putArray("sessionCookie");
    if (path.contains("{id}")) {
      var param = value.putArray("parameters").addObject();
      param
          .put("name", "id")
          .put("in", "path")
          .put("required", true)
          .putObject("schema")
          .put("type", "string");
    }
    if (input != null)
      value
          .putObject("requestBody")
          .put("required", true)
          .putObject("content")
          .putObject("application/json")
          .putObject("schema")
          .put("$ref", "#/components/schemas/" + input);
    var response = value.putObject("responses").putObject(output == null ? "204" : "200");
    response.put("description", output == null ? "Deleted" : "OK");
    if (output != null)
      response
          .putObject("content")
          .putObject("application/json")
          .putObject("schema")
          .put("$ref", "#/components/schemas/" + output);
    if (update) {
      if (!paths.has(path)) paths.putObject(path);
      ((ObjectNode) paths.get(path)).set(method, value);
    } else assertThat(paths.path(path).path(method)).as(method + " " + path).isEqualTo(value);
  }
}
