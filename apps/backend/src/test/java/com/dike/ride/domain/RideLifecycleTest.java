package com.dike.ride.domain;

import static org.assertj.core.api.Assertions.*;

import com.dike.ride.RideResources;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class RideLifecycleTest {
  static final Instant NOW = Instant.parse("2026-10-07T01:00:00Z");

  private Trip trip(int seats) {
    return new Trip(
        "t",
        "d",
        "v",
        "CAR",
        0,
        Trip.Status.OPEN,
        seats,
        seats,
        "route",
        0,
        0,
        NOW,
        NOW.plusSeconds(3600),
        "A",
        "B",
        "PUBLIC",
        null,
        1000,
        5000,
        900,
        List.of(),
        0);
  }

  private Booking booking() {
    return new Booking(
        "b",
        "p",
        "post",
        "intent",
        "t",
        "u",
        "d",
        Booking.Status.CONFIRMED,
        new RideResources.Quote(
            "q",
            "intent",
            "t",
            "u",
            "d",
            0,
            0,
            "route",
            20000,
            NOW,
            NOW.plusSeconds(1800),
            NOW.plusSeconds(60),
            List.of(),
            0,
            0),
        null,
        false,
        NOW,
        0);
  }

  @Test
  void lastSeatClosesTripAndCannotBeSoldTwice() {
    var full = trip(1).reserve(List.of(new RideResources.Stop("pickup", "b", "PICKUP", "A", NOW)));
    assertThat(full.status()).isEqualTo(Trip.Status.FULL);
    assertThat(full.remainingSeats()).isZero();
    assertThatThrownBy(() -> full.reserve(List.of())).hasMessage("NO_SEATS");
    var reopened = full.release("b");
    assertThat(reopened.status()).isEqualTo(Trip.Status.OPEN);
    assertThat(reopened.stops()).isEmpty();
    assertThat(reopened.routeVersion()).isEqualTo(2);
  }

  @Test
  void startClosesEvenUnusedSeats() {
    var started = trip(3).status(Trip.Status.IN_PROGRESS);
    assertThatThrownBy(() -> started.reserve(List.of())).hasMessage("NO_SEATS");
  }

  @Test
  void onlyDriverCanBoardAndCompletedBookingCannotCancel() {
    var b = booking();
    assertThatThrownBy(() -> b.transition(Booking.Action.BOARD, "u", false, null, NOW))
        .hasMessage("INVALID_TRANSITION");
    var boarded = b.transition(Booking.Action.BOARD, "d", false, null, NOW);
    assertThat(boarded.status()).isEqualTo(Booking.Status.BOARDED);
    assertThatThrownBy(() -> boarded.transition(Booking.Action.CANCEL, "u", false, "cancel", NOW))
        .hasMessage("INVALID_TRANSITION");
    var completed =
        boarded
            .start(NOW)
            .transition(Booking.Action.COMPLETE, "d", true, null, NOW.plusSeconds(1800));
    assertThat(completed.active()).isFalse();
    assertThat(completed.agreedTerms().priceVnd()).isEqualTo(20000);
    assertThatThrownBy(() -> completed.transition(Booking.Action.COMPLETE, "d", true, null, NOW))
        .hasMessage("INVALID_TRANSITION");
  }

  @Test
  void noShowRequiresTenMinutesAndReason() {
    var b = booking();
    assertThatThrownBy(
            () -> b.transition(Booking.Action.NO_SHOW, "d", true, "absent", NOW.plusSeconds(599)))
        .hasMessage("NO_SHOW_TOO_EARLY");
    assertThatThrownBy(
            () -> b.transition(Booking.Action.NO_SHOW, "d", true, "", NOW.plusSeconds(600)))
        .hasMessage("REASON_REQUIRED");
    assertThat(
            b.transition(Booking.Action.NO_SHOW, "d", true, "absent", NOW.plusSeconds(600))
                .status())
        .isEqualTo(Booking.Status.NO_SHOW);
  }

  @Test
  void boardingAtLaterStopDuringTripMovesDirectlyToInProgress() {
    assertThat(booking().transition(Booking.Action.BOARD, "d", true, null, NOW).status())
        .isEqualTo(Booking.Status.IN_PROGRESS);
  }

  @Test
  void eitherParticipantCanEndEarlyAfterBoardingButNeverBefore() {
    assertThatThrownBy(
            () -> booking().transition(Booking.Action.END_EARLY, "u", true, "unsafe", NOW))
        .hasMessage("INVALID_TRANSITION");
    assertThat(
            booking()
                .transition(Booking.Action.BOARD, "d", true, null, NOW)
                .transition(Booking.Action.END_EARLY, "u", true, "unsafe", NOW)
                .status())
        .isEqualTo(Booking.Status.ENDED_EARLY);
  }

  @Test
  void nonParticipantCannotChangeBooking() {
    assertThatThrownBy(
            () -> booking().transition(Booking.Action.CANCEL, "stranger", false, "x", NOW))
        .hasMessage("NOT_PARTICIPANT");
  }
}
