package com.dike.ride.application;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.dike.community.*;
import com.dike.planning.*;
import com.dike.ride.*;
import com.dike.ride.domain.*;
import com.dike.shared.api.ApiException;
import com.dike.shared.application.AtomicCommands;
import com.dike.shared.outbox.OutboxPublisher;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;

class RideServiceTest {
  RideStore store;
  RideEligibility access;
  BoardingSecrets secrets;
  RideService service;
  final Instant now = Instant.parse("2026-10-07T01:00:00Z");

  @BeforeEach
  void setup() {
    store = mock(RideStore.class);
    access = mock(RideEligibility.class);
    secrets = mock(BoardingSecrets.class);
    when(access.active(anyString())).thenReturn(true);
    service =
        new RideService(
            store,
            mock(RideResources.class),
            access,
            mock(JourneySources.class),
            mock(PostAccess.class),
            mock(SocialAccessPolicy.class),
            mock(SocialAcceptanceGuard.class),
            mock(CommunityAccess.class),
            mock(AtomicCommands.class),
            mock(OutboxPublisher.class),
            secrets,
            Clock.fixed(now, ZoneOffset.UTC));
    var quote =
        new RideResources.Quote(
            "q",
            "i",
            "t",
            "passenger",
            "driver",
            0,
            0,
            "r",
            12345,
            now,
            now.plusSeconds(900),
            now.plusSeconds(60),
            List.of(),
            0,
            0);
    when(store.booking("b"))
        .thenReturn(
            Optional.of(
                new Booking(
                    "b",
                    "p",
                    "post",
                    "i",
                    "t",
                    "passenger",
                    "driver",
                    Booking.Status.CONFIRMED,
                    quote,
                    null,
                    false,
                    now,
                    0)));
  }

  @Test
  void boardingCodeIsPassengerOnly() {
    when(secrets.reveal("b")).thenReturn("012345");
    assertThat(service.code("passenger", "b")).isEqualTo("012345");
    assertThatThrownBy(() -> service.code("driver", "b")).isInstanceOf(ApiException.class);
    assertThatThrownBy(() -> service.code("stranger", "b")).isInstanceOf(ApiException.class);
    verify(secrets, times(1)).reveal("b");
  }

  @Test
  void unauthorizedBoardingDoesNotConsumeAttemptBudget() {
    assertThatThrownBy(
            () ->
                service.bookingAction(
                    "stranger", "b", 0, Booking.Action.BOARD, null, "123456", "command-key"))
        .isInstanceOf(ApiException.class);
    assertThatThrownBy(
            () ->
                service.bookingAction(
                    "passenger", "b", 0, Booking.Action.BOARD, null, "123456", "command-key"))
        .isInstanceOf(ApiException.class);
    verifyNoInteractions(secrets);
  }

  @Test
  void participantsRetainOperationalReadWhenSocialAccessChanges() {
    assertThat(service.booking("passenger", "b").priceVnd()).isEqualTo(12345);
    assertThat(service.booking("driver", "b").status()).isEqualTo("CONFIRMED");
    assertThatThrownBy(() -> service.booking("stranger", "b")).isInstanceOf(ApiException.class);
  }

  @Test
  void unavailableDependenciesAreNotAdvertisedAsReady() {
    var c = new RideCapabilities(mock(JourneySources.class), mock(RideResources.class), "").view();
    assertThat(c.posting()).isFalse();
    assertThat(c.trips()).isFalse();
    assertThat(c.proposals()).isFalse();
  }

  @Test
  void missingActionIsRejectedWithoutConsumingSecrets() {
    assertThatThrownBy(
            () -> service.bookingAction("driver", "b", 0, null, null, null, "command-key"))
        .isInstanceOf(ApiException.class);
    verifyNoInteractions(secrets);
  }
}
