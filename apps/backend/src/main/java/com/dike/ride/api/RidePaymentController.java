package com.dike.ride.api;

import com.dike.ride.payment.RidePaymentService;
import java.security.Principal;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
public class RidePaymentController {
  private final RidePaymentService service;

  public RidePaymentController(RidePaymentService service) {
    this.service = service;
  }

  @GetMapping("/api/v1/bookings/{bookingId}/payment")
  RidePaymentService.View get(Principal principal, @PathVariable String bookingId) {
    return service.get(principal.getName(), bookingId);
  }

  @PostMapping("/api/v1/bookings/{bookingId}/payment/checkout")
  RidePaymentService.View checkout(Principal principal, @PathVariable String bookingId) {
    return service.checkout(principal.getName(), bookingId);
  }

  @PostMapping("/api/v1/bookings/{bookingId}/payment/payout")
  RidePaymentService.View payout(
      Principal principal,
      @PathVariable String bookingId,
      @RequestBody RidePaymentService.PayoutRequest request) {
    return service.payout(principal.getName(), bookingId, request);
  }

  @PostMapping("/api/v1/webhooks/payos")
  ResponseEntity<Void> webhook(@RequestBody Object body) {
    service.webhook(body);
    return ResponseEntity.ok().build();
  }
}
