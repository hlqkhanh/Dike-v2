package com.dike.messaging;

import java.security.Principal;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/realtime")
class RealtimeTicketController {

  private final RealtimeTicketService tickets;

  RealtimeTicketController(RealtimeTicketService tickets) {
    this.tickets = tickets;
  }

  @PostMapping("/tickets")
  ResponseEntity<RealtimeTicket> issue(Principal principal) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(tickets.issue(principal.getName()));
  }
}
