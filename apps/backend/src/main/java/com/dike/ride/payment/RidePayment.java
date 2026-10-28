package com.dike.ride.payment;

import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("ride_payments")
record RidePayment(
    @Id String bookingId,
    long orderCode,
    String passengerId,
    String driverId,
    long amountVnd,
    String status,
    String paymentLinkId,
    String checkoutUrl,
    String qrCode,
    String bankReference,
    Instant expiresAt,
    Instant paidAt,
    String payoutId,
    String payoutStatus,
    String payoutDestination,
    Instant paidOutAt,
    Instant createdAt,
    Instant updatedAt,
    long version) {}
