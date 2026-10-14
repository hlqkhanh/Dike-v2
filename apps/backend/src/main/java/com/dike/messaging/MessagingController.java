package com.dike.messaging;

import java.security.Principal;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
class MessagingController {

  private final MessagingService service;

  MessagingController(MessagingService service) {
    this.service = service;
  }

  record DirectRequest(String recipientUserId) {}

  record DiscussPostRequest(String postId) {}

  record RequestDecision(long version) {}

  record SendMessage(String clientMessageId, String text, String postId) {}

  record ReadMarker(long sequence) {}

  @PostMapping("/conversations/direct")
  MessagingService.ConversationView direct(Principal principal, @RequestBody DirectRequest body) {
    return service.direct(principal.getName(), body.recipientUserId());
  }

  @PostMapping("/conversations/ride-post")
  MessagingService.ConversationView discussPost(
      Principal principal, @RequestBody DiscussPostRequest body) {
    return service.discussPost(principal.getName(), body.postId());
  }

  @GetMapping("/conversations")
  List<MessagingService.ConversationView> conversations(
      Principal principal,
      @RequestParam(required = false) String cursor,
      @RequestParam(defaultValue = "20") int limit) {
    return service.conversations(principal.getName(), cursor, limit);
  }

  @GetMapping("/conversations/{id}")
  MessagingService.ConversationView conversation(Principal principal, @PathVariable String id) {
    return service.conversation(principal.getName(), id);
  }

  @PostMapping("/message-requests/{id}/accept")
  MessagingService.ConversationView accept(
      Principal principal, @PathVariable String id, @RequestBody RequestDecision body) {
    return service.decideRequest(principal.getName(), id, true, body.version());
  }

  @PostMapping("/message-requests/{id}/reject")
  MessagingService.ConversationView reject(
      Principal principal, @PathVariable String id, @RequestBody RequestDecision body) {
    return service.decideRequest(principal.getName(), id, false, body.version());
  }

  @PostMapping("/conversations/{id}/messages")
  MessagingService.MessageView send(
      Principal principal, @PathVariable String id, @RequestBody SendMessage body) {
    return service.send(
        principal.getName(), id, body.clientMessageId(), body.text(), body.postId());
  }

  @GetMapping("/conversations/{id}/messages")
  List<MessagingService.MessageView> messages(
      Principal principal,
      @PathVariable String id,
      @RequestParam(required = false) Long beforeSequence,
      @RequestParam(defaultValue = "30") int limit) {
    return service.messages(principal.getName(), id, beforeSequence, limit);
  }

  @PostMapping("/conversations/{id}/read")
  void read(Principal principal, @PathVariable String id, @RequestBody ReadMarker body) {
    service.read(principal.getName(), id, body.sequence());
  }

  @GetMapping("/notifications")
  List<MessagingService.NotificationView> notifications(
      Principal principal,
      @RequestParam(required = false) String cursor,
      @RequestParam(defaultValue = "20") int limit) {
    return service.notifications(principal.getName(), cursor, limit);
  }

  @PatchMapping("/notifications/{id}/read")
  void notificationRead(Principal principal, @PathVariable String id) {
    service.markNotificationRead(principal.getName(), id);
  }

  @PostMapping("/notifications/read-all")
  void allRead(Principal principal) {
    service.markAllNotificationsRead(principal.getName());
  }
}
