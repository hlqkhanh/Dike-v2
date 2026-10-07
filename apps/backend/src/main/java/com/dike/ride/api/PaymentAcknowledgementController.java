package com.dike.ride.api;

import com.dike.ride.PaymentAcknowledgementService;
import java.security.Principal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/bookings/{bookingId}/payment-acknowledgement")
public class PaymentAcknowledgementController {

  private final PaymentAcknowledgementService service;

  public PaymentAcknowledgementController(PaymentAcknowledgementService service) {
    this.service = service;
  }

  @GetMapping
  PaymentAcknowledgementService.View get(Principal principal, @PathVariable String bookingId) {
    return service.get(principal.getName(), bookingId);
  }

  @PutMapping("/paid")
  PaymentAcknowledgementService.View paid(Principal principal, @PathVariable String bookingId) {
    return service.acknowledge(principal.getName(), bookingId, true);
  }

  @DeleteMapping("/paid")
  PaymentAcknowledgementService.View retractPaid(
      Principal principal, @PathVariable String bookingId) {
    return service.retract(principal.getName(), bookingId, true);
  }

  @PutMapping("/received")
  PaymentAcknowledgementService.View received(Principal principal, @PathVariable String bookingId) {
    return service.acknowledge(principal.getName(), bookingId, false);
  }

  @DeleteMapping("/received")
  PaymentAcknowledgementService.View retractReceived(
      Principal principal, @PathVariable String bookingId) {
    return service.retract(principal.getName(), bookingId, false);
  }
}
