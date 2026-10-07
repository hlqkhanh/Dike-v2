package com.dike.planning.infrastructure.mongo;

import com.dike.planning.domain.ActivityCategory;
import com.dike.planning.domain.ScheduleDirection;
import com.dike.planning.domain.ScheduleStatus;
import com.dike.planning.domain.ScheduleVisibility;
import com.dike.planning.domain.TravelRole;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Set;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("schedule_rules")
record ScheduleRuleDocument(
    @Id String id,
    String ownerUserId,
    String name,
    ActivityCategory activityCategory,
    Set<DayOfWeek> weekdays,
    LocalDate effectiveFrom,
    LocalDate effectiveUntil,
    LocalTime startLocalTime,
    LocalTime endLocalTime,
    String zoneId,
    PlaceDocument activityPlace,
    PlaceDocument usualOrigin,
    int arrivalBufferMinutes,
    Set<ScheduleDirection> directions,
    TravelRole defaultTravelRole,
    ScheduleVisibility visibility,
    ScheduleStatus status,
    long version,
    Instant createdAt,
    Instant updatedAt) {}
