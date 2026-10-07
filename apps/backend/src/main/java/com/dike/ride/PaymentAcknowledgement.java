package com.dike.ride;

import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("payment_acknowledgements")
record PaymentAcknowledgement(
    @Id String bookingId,
    String passengerId,
    String driverId,
    long amountVnd,
    Instant passengerPaidAt,
    Instant driverReceivedAt,
    Instant lockedAt,
    long version) {}
