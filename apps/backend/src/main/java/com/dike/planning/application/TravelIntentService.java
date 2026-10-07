package com.dike.planning.application;

import com.dike.identity.IdentityAccess;
import com.dike.planning.domain.PlaceSnapshot;
import com.dike.planning.domain.ScheduleDirection;
import com.dike.planning.domain.TravelIntent;
import com.dike.planning.domain.TravelIntentCommitmentState;
import com.dike.planning.domain.TravelIntentSourceType;
import com.dike.planning.domain.TravelRole;
import com.dike.shared.api.ApiException;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class TravelIntentService {
  private final PlanningStore store;
  private final ResolvedPlaceStore places;
  private final IdentityAccess accounts;
  private final Clock clock;

  public TravelIntentService(
      PlanningStore store, ResolvedPlaceStore places, IdentityAccess accounts, Clock clock) {
    this.store = store;
    this.places = places;
    this.accounts = accounts;
    this.clock = clock;
  }

  public List<TravelIntent> list(String owner, LocalDate from, LocalDate to) {
    accounts.require(owner);
    if (from.isAfter(to) || from.until(to).getDays() > 31) {
      throw invalid("Date range invalid or too large");
    }
    return store.intents(owner, from, to);
  }

  public TravelIntent get(String owner, String id) {
    accounts.require(owner);
    return store.intent(id).filter(i -> i.ownerUserId().equals(owner)).orElseThrow(this::notFound);
  }

  public TravelIntent createManual(String owner, CreateManual command, String key) {
    accounts.require(owner);
    if (key == null || !key.matches("[A-Za-z0-9_-]{8,100}"))
      throw invalid("Invalid idempotency key");

    String id = "manual-" + UUID.nameUUIDFromBytes((owner + ":" + key).getBytes()).toString();

    TravelIntent intent =
        new TravelIntent(
            id,
            owner,
            TravelIntentSourceType.MANUAL,
            null,
            0,
            command.localDate(),
            command.direction(),
            command.travelRole(),
            resolve(owner, command.origin()),
            resolve(owner, command.destination()),
            command.earliestDepartureAt(),
            command.arrivalDeadlineAt(),
            TravelIntentCommitmentState.PRIVATE,
            false,
            0,
            null,
            clock.instant(),
            clock.instant());

    try {
      return store.insertIntent(intent);
    } catch (DuplicateKeyException duplicate) {
      return store.intent(id).orElseThrow();
    }
  }

  public TravelIntent replaceManual(String owner, String id, long version, CreateManual command) {
    accounts.require(owner);
    TravelIntent existing = get(owner, id);
    if (existing.sourceType() != TravelIntentSourceType.MANUAL) {
      throw new ApiException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          "PLANNING_NOT_MANUAL",
          "Cannot modify non-manual intent directly");
    }
    if (existing.version() != version) {
      throw new org.springframework.dao.OptimisticLockingFailureException("Version mismatch");
    }
    if (existing.commitmentState() != TravelIntentCommitmentState.PRIVATE
        && existing.commitmentState() != TravelIntentCommitmentState.CANCELLED) {
      throw new ApiException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          "PLANNING_INVALID_STATE",
          "Cannot modify intent in state " + existing.commitmentState());
    }

    TravelIntent desired =
        new TravelIntent(
            existing.id(),
            existing.ownerUserId(),
            existing.sourceType(),
            existing.scheduleId(),
            existing.sourceVersion(),
            command.localDate(),
            command.direction(),
            command.travelRole(),
            resolve(owner, command.origin()),
            resolve(owner, command.destination()),
            command.earliestDepartureAt(),
            command.arrivalDeadlineAt(),
            TravelIntentCommitmentState.PRIVATE,
            false,
            existing.version() + 1,
            existing.matchedWithUserId(),
            existing.createdAt(),
            clock.instant());

    return store.replaceIntent(existing, desired);
  }

  public TravelIntent cancel(String owner, String id) {
    accounts.require(owner);
    TravelIntent existing = get(owner, id);
    if (existing.commitmentState() == TravelIntentCommitmentState.CANCELLED) return existing;
    if (existing.commitmentState() != TravelIntentCommitmentState.PRIVATE) {
      throw new ApiException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          "PLANNING_INVALID_STATE",
          "Cannot cancel intent in state " + existing.commitmentState());
    }

    TravelIntent desired =
        new TravelIntent(
            existing.id(),
            existing.ownerUserId(),
            existing.sourceType(),
            existing.scheduleId(),
            existing.sourceVersion(),
            existing.localDate(),
            existing.direction(),
            existing.travelRole(),
            existing.origin(),
            existing.destination(),
            existing.earliestDepartureAt(),
            existing.arrivalDeadlineAt(),
            TravelIntentCommitmentState.CANCELLED,
            existing.sourceChanged(),
            existing.version() + 1,
            existing.matchedWithUserId(),
            existing.createdAt(),
            clock.instant());

    return store.replaceIntent(existing, desired);
  }

  public TravelIntent requestMatch(String requesterUserId, String targetIntentId) {
    accounts.require(requesterUserId);
    throw new ApiException(
        HttpStatus.GONE,
        "USE_PROPOSAL_FLOW",
        "Hãy gửi đề nghị đi cùng từ bài đăng; thao tác này không tạo booking");
  }

  private PlaceSnapshot resolve(String owner, String providerPlaceId) {
    return places
        .find(owner, providerPlaceId)
        .orElseThrow(() -> invalid("Place not found: " + providerPlaceId));
  }

  private ApiException invalid(String msg) {
    return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", msg);
  }

  private ApiException notFound() {
    return new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Intent not found");
  }

  public record CreateManual(
      LocalDate localDate,
      ScheduleDirection direction,
      TravelRole travelRole,
      String origin,
      String destination,
      Instant earliestDepartureAt,
      Instant arrivalDeadlineAt) {}
}
