package com.dike.community.api;

import com.dike.community.application.SocialService;
import com.dike.community.application.SocialService.RelationPage;
import com.dike.community.application.SocialService.RelationView;
import com.dike.community.application.SocialService.RevisionView;
import com.dike.community.domain.SocialRelation.Action;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import java.security.Principal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
@SecurityRequirement(name = "sessionCookie")
public class SocialController {
  private final SocialService social;

  public SocialController(SocialService social) {
    this.social = social;
  }

  public record SendRequest(
      @NotBlank @Pattern(regexp = "[A-Za-z0-9_-]{1,100}") String targetUserId) {}

  @GetMapping("/friendships")
  @Operation(operationId = "listFriendships")
  public RelationPage friends(
      Principal actor,
      @RequestParam(required = false) String cursor,
      @RequestParam(defaultValue = "20") int limit) {
    return social.list(actor.getName(), "friends", cursor, limit);
  }

  @GetMapping("/friendships/requests")
  @Operation(operationId = "listFriendRequests")
  public RelationPage requests(
      Principal actor,
      @RequestParam(defaultValue = "incoming") String direction,
      @RequestParam(required = false) String cursor,
      @RequestParam(defaultValue = "20") int limit) {
    if (!direction.equals("incoming") && !direction.equals("outgoing"))
      throw new com.dike.shared.api.ApiException(
          org.springframework.http.HttpStatus.UNPROCESSABLE_ENTITY,
          "SOCIAL_INVALID_REQUEST",
          "Hướng lời mời không hợp lệ");
    return social.list(actor.getName(), direction, cursor, limit);
  }

  @GetMapping("/friendships/users/{target}")
  @Operation(operationId = "getSocialRelation")
  public RelationView relation(Principal actor, @PathVariable String target) {
    return social.relation(actor.getName(), target);
  }

  @PostMapping("/friendships/requests")
  @Operation(operationId = "sendFriendRequest")
  public RelationView send(
      Principal actor,
      @Valid @RequestBody SendRequest body,
      @RequestHeader("Idempotency-Key") String key) {
    return social.command(actor.getName(), Action.SEND, body.targetUserId(), null, key);
  }

  @PostMapping("/friendships/requests/{requestId}/accept")
  @Operation(operationId = "acceptFriendRequest")
  public RelationView accept(
      Principal actor,
      @PathVariable String requestId,
      @RequestHeader("Idempotency-Key") String key) {
    return social.command(actor.getName(), Action.ACCEPT, null, requestId, key);
  }

  @PostMapping("/friendships/requests/{requestId}/decline")
  @Operation(operationId = "declineFriendRequest")
  public RelationView decline(
      Principal actor,
      @PathVariable String requestId,
      @RequestHeader("Idempotency-Key") String key) {
    return social.command(actor.getName(), Action.DECLINE, null, requestId, key);
  }

  @PostMapping("/friendships/requests/{requestId}/cancel")
  @Operation(operationId = "cancelFriendRequest")
  public RelationView cancel(
      Principal actor,
      @PathVariable String requestId,
      @RequestHeader("Idempotency-Key") String key) {
    return social.command(actor.getName(), Action.CANCEL, null, requestId, key);
  }

  @DeleteMapping("/friendships/{target}")
  @Operation(operationId = "removeFriend")
  public RelationView remove(
      Principal actor, @PathVariable String target, @RequestHeader("Idempotency-Key") String key) {
    return social.command(actor.getName(), Action.REMOVE, target, null, key);
  }

  @GetMapping("/blocks")
  @Operation(operationId = "listBlocks")
  public RelationPage blocks(
      Principal actor,
      @RequestParam(required = false) String cursor,
      @RequestParam(defaultValue = "20") int limit) {
    return social.list(actor.getName(), "blocks", cursor, limit);
  }

  @PutMapping("/blocks/{target}")
  @Operation(operationId = "blockUser")
  public RelationView block(
      Principal actor, @PathVariable String target, @RequestHeader("Idempotency-Key") String key) {
    return social.command(actor.getName(), Action.BLOCK, target, null, key);
  }

  @DeleteMapping("/blocks/{target}")
  @Operation(operationId = "unblockUser")
  public RelationView unblock(
      Principal actor, @PathVariable String target, @RequestHeader("Idempotency-Key") String key) {
    return social.command(actor.getName(), Action.UNBLOCK, target, null, key);
  }

  @GetMapping("/social/revision")
  @Operation(operationId = "getSocialRevision")
  public RevisionView revision(Principal actor) {
    return social.revision(actor.getName());
  }
}
