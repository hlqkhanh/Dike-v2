package com.dike.planning.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.dike.identity.IdentityAccess;
import com.dike.planning.domain.ActivityCategory;
import com.dike.planning.domain.PlaceSnapshot;
import com.dike.planning.domain.ScheduleDirection;
import com.dike.planning.domain.ScheduleRule;
import com.dike.planning.domain.ScheduleVisibility;
import com.dike.planning.domain.TravelRole;
import com.dike.shared.outbox.OutboxPublisher;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ScheduleServiceTest {

  private static final Instant NOW = Instant.parse("2026-10-07T00:00:00Z");
  private PlanningStore store;
  private IdentityAccess accounts;
  private com.dike.community.SocialAccessPolicy social;
  private OutboxPublisher events;
  private ScheduleService service;

  @BeforeEach
  void setUp() {
    store = mock(PlanningStore.class);
    when(store.insertSchedule(any())).thenAnswer(call -> call.getArgument(0));
    accounts = mock(IdentityAccess.class);
    social = mock(com.dike.community.SocialAccessPolicy.class);
    events = mock(OutboxPublisher.class);
    PlaceSnapshot home = place("home");
    PlaceSnapshot school = place("school");
    ResolvedPlaceStore places = mock(ResolvedPlaceStore.class);
    when(places.find("user-1", "home-ref1")).thenReturn(Optional.of(home));
    when(places.find("user-1", "school-r1")).thenReturn(Optional.of(school));
    service =
        new ScheduleService(
            store,
            places,
            accounts,
            social,
            events,
            Clock.fixed(NOW, ZoneOffset.UTC),
            () -> "schedule-1");
  }

  @Test
  void createsVerifiedMemberScheduleAndEmitsMaterializationSignal() {
    allow(false);

    ScheduleRule value = service.create("user-1", command(TravelRole.RIDER));

    assertThat(value.activityPlace().providerPlaceId()).isEqualTo("school");
    assertThat(value.usualOrigin().providerPlaceId()).isEqualTo("home");
    verify(events)
        .publish(
            org.mockito.ArgumentMatchers.eq("planning.schedule.changed"),
            anyString(),
            org.mockito.ArgumentMatchers.eq("schedule-1"),
            anyInt(),
            anyMap());
  }

  @Test
  void rejectsDriverRoleWithoutCurrentApproval() {
    allow(false);

    assertThatThrownBy(() -> service.create("user-1", command(TravelRole.DRIVER)))
        .isInstanceOf(ScheduleService.ScheduleDriverRequiredException.class);
  }

  private void allow(boolean driver) {
    when(accounts.require("user-1"))
        .thenReturn(
            new IdentityAccess.Access(
                "user-1",
                true,
                true,
                driver,
                driver
                    ? IdentityAccess.DriverEvidence.SIMULATED
                    : IdentityAccess.DriverEvidence.NONE,
                0));
  }

  private ScheduleService.RuleCommand command(TravelRole role) {
    return new ScheduleService.RuleCommand(
        "Morning class",
        ActivityCategory.STUDY,
        Set.of(DayOfWeek.MONDAY),
        LocalDate.parse("2026-10-12"),
        null,
        LocalTime.of(8, 0),
        LocalTime.of(10, 0),
        ScheduleRule.V1_ZONE,
        "school-r1",
        "home-ref1",
        15,
        Set.of(ScheduleDirection.OUTBOUND, ScheduleDirection.RETURN),
        role,
        ScheduleVisibility.PRIVATE);
  }

  private PlaceSnapshot place(String id) {
    return new PlaceSnapshot("FAKE", id, id, "District", 106.7, 10.77, NOW);
  }
}
