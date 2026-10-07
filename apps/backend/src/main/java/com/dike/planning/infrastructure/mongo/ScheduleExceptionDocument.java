package com.dike.planning.infrastructure.mongo;

import com.dike.planning.domain.ScheduleDirection;
import com.dike.planning.domain.ScheduleExceptionType;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Set;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("schedule_exceptions")
record ScheduleExceptionDocument(
    @Id String id,
    String scheduleId,
    String ownerUserId,
    LocalDate localDate,
    ScheduleExceptionType type,
    LocalTime startLocalTime,
    LocalTime endLocalTime,
    PlaceDocument activityPlace,
    PlaceDocument usualOrigin,
    Set<ScheduleDirection> directions,
    long version,
    Instant createdAt,
    Instant updatedAt) {}
