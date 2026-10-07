package com.dike.ride;

import com.dike.messaging.MessagingService;
import com.dike.shared.outbox.OutboxEvent;
import com.dike.shared.outbox.OutboxHandler;
import org.springframework.stereotype.Component;

@Component
class BookingConversationHandler implements OutboxHandler {
  private final RideParticipantAccess rides;
  private final MessagingService messaging;

  BookingConversationHandler(RideParticipantAccess rides, MessagingService messaging) {
    this.rides = rides;
    this.messaging = messaging;
  }

  public String consumerName() {
    return "ride.booking-conversation.v1";
  }

  public String eventType() {
    return "booking.confirmed";
  }

  public int payloadVersion() {
    return 1;
  }

  public void handle(OutboxEvent event) {
    rides
        .booking(event.aggregateId())
        .ifPresent(
            booking -> {
              messaging.ensureBookingConversation(
                  booking.id(), booking.passengerId(), booking.driverId());
              messaging.notify(
                  booking.passengerId(),
                  "BOOKING_CONFIRMED",
                  "Chuyến đi đã được xác nhận",
                  "Bạn có thể nhắn tin với tài xế trong hội thoại chuyến đi.",
                  java.util.Map.of("bookingId", booking.id()));
              messaging.notify(
                  booking.driverId(),
                  "BOOKING_CONFIRMED",
                  "Chuyến đi đã được xác nhận",
                  "Bạn có thể nhắn tin với hành khách trong hội thoại chuyến đi.",
                  java.util.Map.of("bookingId", booking.id()));
            });
  }
}
