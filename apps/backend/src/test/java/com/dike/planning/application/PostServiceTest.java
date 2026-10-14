package com.dike.planning.application;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.dike.community.*;
import com.dike.planning.*;
import com.dike.planning.domain.RidePost;
import com.dike.shared.api.ApiException;
import com.dike.shared.application.AtomicCommands;
import com.dike.shared.outbox.OutboxPublisher;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;

class PostServiceTest {
  PostService service;
  PostStore store;
  SocialAccessPolicy social;
  PostAccounts accounts;
  TripSource trips;
  final Instant now = Instant.parse("2026-10-07T00:00:00Z");

  @BeforeEach
  void setup() {
    store = mock(PostStore.class);
    social = mock(SocialAccessPolicy.class);
    accounts = mock(PostAccounts.class);
    trips = mock(TripSource.class);
    when(accounts.active(anyString())).thenReturn(true);
    service =
        new PostService(
            store,
            mock(JourneySources.class),
            trips,
            accounts,
            mock(CommunityAccess.class),
            social,
            mock(AtomicCommands.class),
            mock(OutboxPublisher.class),
            Clock.fixed(now, ZoneOffset.UTC));
  }

  RidePost post(RidePost.Status status, String reason) {
    return new RidePost(
        "p",
        "owner",
        RidePost.Type.NEED_RIDE,
        "i",
        0,
        status,
        "PUBLIC",
        null,
        "A",
        "B",
        "CAR",
        "r",
        now.plusSeconds(3600),
        now.plusSeconds(4000),
        "",
        0,
        0,
        reason,
        now);
  }

  @Test
  void directUrlAndSavedPostsRecheckLiveAccess() {
    var p = post(RidePost.Status.OPEN, null);
    when(store.find("p")).thenReturn(Optional.of(p));
    when(store.saved("viewer", null, 20)).thenReturn(List.of("p"));
    assertThatThrownBy(() -> service.detail("viewer", "p")).isInstanceOf(ApiException.class);
    assertThat(service.saved("viewer", null, 20).items()).isEmpty();
  }

  @Test
  void ownerCanReadDraftButOtherUsersCannot() {
    var p = post(RidePost.Status.DRAFT, null);
    when(store.find("p")).thenReturn(Optional.of(p));
    when(social.canRead(anyString(), anyString(), any(), anyBoolean())).thenReturn(true);
    assertThat(service.detail("owner", "p").status()).isEqualTo("DRAFT");
    assertThatThrownBy(() -> service.detail("viewer", "p")).isInstanceOf(ApiException.class);
  }

  @Test
  void visiblePostIncludesAuthorNameAndAvatar() {
    when(store.find("p")).thenReturn(Optional.of(post(RidePost.Status.OPEN, null)));
    when(social.canRead(anyString(), anyString(), any(), anyBoolean())).thenReturn(true);
    when(accounts.displayName("owner")).thenReturn("Named author");
    when(accounts.avatarUrl("owner")).thenReturn("https://images.example/avatar.png");

    var view = service.detail("viewer", "p");

    assertThat(view.ownerDisplayName()).isEqualTo("Named author");
    assertThat(view.ownerAvatarUrl()).isEqualTo("https://images.example/avatar.png");
  }

  @Test
  void feedFiltersBeforeReturningAndContinuesPastHiddenRows() {
    when(store.scan(null, 1, null)).thenReturn(List.of(post(RidePost.Status.OPEN, null)));
    var page = service.feed("viewer", "latest", null, 1, null, null, null);
    assertThat(page.items()).isEmpty();
    assertThat(page.nextCursor()).isEqualTo("p");
  }

  @Test
  void feedSkipsOfferWhoseTripNoLongerExists() {
    var base = post(RidePost.Status.OPEN, null);
    var orphan =
        new RidePost(
            base.id(),
            "viewer",
            RidePost.Type.OFFER_RIDE,
            "missing-trip",
            base.sourceVersion(),
            base.status(),
            base.visibility(),
            base.communityId(),
            base.originLabel(),
            base.destinationLabel(),
            base.vehicleType(),
            base.routeId(),
            base.departureAt(),
            base.expiresAt(),
            base.note(),
            base.version(),
            base.termsVersion(),
            base.closureReason(),
            base.publishedAt());
    when(store.scan(null, 20, null)).thenReturn(List.of(orphan));
    when(trips.offer("missing-trip")).thenReturn(Optional.empty());

    assertThat(service.feed("viewer", "latest", null, 20, null, null, null).items()).isEmpty();
  }

  @Test
  void emptySeatDoesNotReopenOwnerClosedOffer() {
    var p = post(RidePost.Status.CLOSED, "OWNER_CLOSED");
    var offer =
        new RidePost(
            p.id(),
            p.ownerId(),
            RidePost.Type.OFFER_RIDE,
            "t",
            0,
            p.status(),
            p.visibility(),
            null,
            "A",
            "B",
            "CAR",
            "r",
            p.departureAt(),
            p.expiresAt(),
            "",
            0,
            0,
            p.closureReason(),
            now);
    when(store.bySource("t")).thenReturn(List.of(offer));
    service.reopenOffer("t", false);
    verify(store, never()).save(any(), any());
  }

  @Test
  void autoFullOfferReopensBeforeDeparture() {
    var offer =
        new RidePost(
            "p",
            "owner",
            RidePost.Type.OFFER_RIDE,
            "t",
            0,
            RidePost.Status.MATCHED,
            "PUBLIC",
            null,
            "A",
            "B",
            "CAR",
            "r",
            now.plusSeconds(3600),
            now.plusSeconds(3600),
            "",
            0,
            0,
            "AUTO_FULL",
            now);
    when(store.bySource("t")).thenReturn(List.of(offer));
    service.reopenOffer("t", false);
    verify(store)
        .save(eq(offer), argThat(p -> p.status() == RidePost.Status.OPEN && p.version() == 1));
  }

  @Test
  void openingTripPublishesOfferToFeed() {
    when(store.bySource("t")).thenReturn(List.of());
    when(trips.offer("t"))
        .thenReturn(
            Optional.of(
                new TripSource.Offer(
                    "t",
                    "owner",
                    "OPEN",
                    1,
                    0,
                    "PUBLIC",
                    "",
                    "A",
                    "B",
                    now.plusSeconds(3600),
                    2,
                    1000,
                    "CAR",
                    "r")));

    service.publishOffer("t");

    verify(store)
        .insert(
            argThat(
                p ->
                    p.type() == RidePost.Type.OFFER_RIDE
                        && p.status() == RidePost.Status.OPEN
                        && p.sourceId().equals("t")
                        && p.sourceVersion() == 1
                        && p.publishedAt().equals(now)));
  }

  @Test
  void malformedVisibilityReturnsControlledError() {
    when(accounts.verified("owner")).thenReturn(true);
    assertThatThrownBy(
            () ->
                service.create(
                    "owner",
                    new PostService.Create(RidePost.Type.NEED_RIDE, "i", 0, null, null, ""),
                    "command-key"))
        .isInstanceOf(ApiException.class);
  }
}
