package com.dike.assistant.api;

import com.dike.assistant.application.AssistantService;
import com.dike.planning.AssistantPlanning;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.security.Principal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/assistant/conversations")
@SecurityRequirement(name = "sessionCookie")
public class AssistantController {
  private final AssistantService service;

  public AssistantController(AssistantService service) {
    this.service = service;
  }

  @io.swagger.v3.oas.annotations.media.Schema(name = "AssistantMessageInput")
  public record Message(
      @NotBlank @Size(max = 2000) String text,
      Long draftVersion,
      java.util.Map<String, String> fields) {}

  @PostMapping
  @Operation(operationId = "createAssistantConversation")
  public AssistantService.Conversation create(Principal actor) {
    return service.create(actor.getName());
  }

  @GetMapping("/{id}")
  @Operation(operationId = "getAssistantConversation")
  public AssistantService.Conversation get(Principal actor, @PathVariable String id) {
    return service.get(actor.getName(), id);
  }

  @PostMapping("/{id}/messages")
  @Operation(operationId = "sendAssistantMessage")
  public AssistantService.Reply message(
      Principal actor, @PathVariable String id, @Valid @RequestBody Message input) {
    return service.message(actor.getName(), id, input.text(), input.draftVersion(), input.fields());
  }

  @PostMapping("/{id}/confirm")
  @Operation(operationId = "confirmAssistantDraft")
  public AssistantPlanning.Result confirm(
      Principal actor, @PathVariable String id, @RequestBody AssistantService.Confirmation input) {
    return service.confirm(actor.getName(), id, input);
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
  @Operation(operationId = "deleteAssistantConversation")
  public void delete(Principal actor, @PathVariable String id) {
    service.delete(actor.getName(), id);
  }
}
