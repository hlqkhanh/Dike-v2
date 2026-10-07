package com.dike.planning.infrastructure.mongo;

import com.dike.planning.domain.ScheduleDirection;
import com.dike.planning.domain.TravelIntentCommitmentState;
import com.dike.planning.domain.TravelIntentSourceType;
import com.dike.planning.domain.TravelRole;
import java.time.Instant;
import java.time.LocalDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("travel_intents")
record TravelIntentDocument(
    @Id String id,
    String ownerUserId,
    TravelIntentSourceType sourceType,
    String scheduleId,
    long sourceVersion,
    LocalDate localDate,
    ScheduleDirection direction,
    TravelRole travelRole,
    PlaceDocument origin,
    PlaceDocument destination,
    Instant earliestDepartureAt,
    Instant arrivalDeadlineAt,
    TravelIntentCommitmentState commitmentState,
    boolean sourceChanged,
    long version,
    String matchedWithUserId,
    Instant createdAt,
    Instant updatedAt) {}
