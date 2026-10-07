package com.dike.planning.api;

import com.dike.planning.application.ScheduleService;
import com.dike.planning.application.ScheduleService.ExceptionCommand;
import com.dike.planning.application.ScheduleService.RuleCommand;
import com.dike.planning.domain.ActivityCategory;
import com.dike.planning.domain.PlaceSnapshot;
import com.dike.planning.domain.ScheduleDirection;
import com.dike.planning.domain.ScheduleException;
import com.dike.planning.domain.ScheduleExceptionType;
import com.dike.planning.domain.ScheduleRule;
import com.dike.planning.domain.ScheduleStatus;
import com.dike.planning.domain.ScheduleVisibility;
import com.dike.planning.domain.TravelRole;
import com.dike.shared.api.ApiException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.security.Principal;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/schedules")
@SecurityRequirement(name = "sessionCookie")
public class ScheduleController {

  private final ScheduleService schedules;
  private final java.time.Clock clock;

  public ScheduleController(ScheduleService schedules, java.time.Clock clock) {
    this.schedules = schedules;
    this.clock = clock;
  }

  public record RuleRequest(
      @NotBlank @Size(max = 80) String name,
      @NotNull ActivityCategory activityCategory,
      @NotEmpty Set<DayOfWeek> weekdays,
      @NotNull LocalDate effectiveFrom,
      LocalDate effectiveUntil,
      @NotNull LocalTime startLocalTime,
      @NotNull LocalTime endLocalTime,
      @NotBlank String zoneId,
      @NotBlank String activityPlaceRef,
      @NotBlank String usualOriginRef,
      @Min(0) @Max(180) int arrivalBufferMinutes,
      @NotEmpty Set<ScheduleDirection> directions,
      @NotNull TravelRole defaultTravelRole,
      @NotNull ScheduleVisibility visibility) {}

  public record ExceptionRequest(
      @NotNull ScheduleExceptionType type,
      LocalTime startLocalTime,
      LocalTime endLocalTime,
      String activityPlaceRef,
      String usualOriginRef,
      Set<ScheduleDirection> directions,
      @Min(0) long version) {}

  public record PlaceView(
      String displayLabel, String publicAreaLabel, double longitude, double latitude) {}

  public record ScheduleResponse(
      String id,
      String name,
      ActivityCategory activityCategory,
      Set<DayOfWeek> weekdays,
      LocalDate effectiveFrom,
      LocalDate effectiveUntil,
      LocalTime startLocalTime,
      LocalTime endLocalTime,
      String zoneId,
      PlaceView activityPlace,
      PlaceView usualOrigin,
      int arrivalBufferMinutes,
      Set<ScheduleDirection> directions,
      TravelRole defaultTravelRole,
      ScheduleVisibility visibility,
      ScheduleStatus status,
      long version,
      List<ScheduleService.Conflict> warnings) {}

  public record ExceptionResponse(
      String id,
      LocalDate localDate,
      ScheduleExceptionType type,
      LocalTime startLocalTime,
      LocalTime endLocalTime,
      PlaceView activityPlace,
      PlaceView usualOrigin,
      Set<ScheduleDirection> directions,
      long version,
      List<ScheduleService.Conflict> warnings) {}

  @PostMapping
  @Operation(operationId = "createSchedule")
  public ScheduleResponse create(Principal actor, @Valid @RequestBody RuleRequest request) {
    try {
      ScheduleRule saved = schedules.create(actor.getName(), command(request));
      return response(saved, checkWarnings(actor.getName(), saved, saved.effectiveFrom()));
    } catch (RuntimeException error) {
      throw mapped(error);
    }
  }

  @GetMapping
  @Operation(operationId = "listSchedules")
  public List<ScheduleResponse> list(Principal actor) {
    try {
      return schedules.list(actor.getName()).stream().map(s -> response(s, List.of())).toList();
    } catch (RuntimeException error) {
      throw mapped(error);
    }
  }

  public record FriendScheduleResponse(
      String ownerUserId,
      Set<DayOfWeek> weekdays,
      LocalDate effectiveFrom,
      LocalDate effectiveUntil,
      LocalTime startLocalTime,
      LocalTime endLocalTime,
      Set<ScheduleDirection> directions,
      TravelRole defaultTravelRole,
      ActivityCategory activityCategory,
      String publicAreaLabel) {}

  @GetMapping("/friends")
  @Operation(operationId = "listFriendsSchedules")
  public List<FriendScheduleResponse> listFriends(Principal actor) {
    try {
      return schedules.listFriendsSchedules(actor.getName()).stream()
          .map(
              s ->
                  new FriendScheduleResponse(
                      s.ownerUserId(),
                      s.weekdays(),
                      s.effectiveFrom(),
                      s.effectiveUntil(),
                      s.startLocalTime(),
                      s.endLocalTime(),
                      s.directions(),
                      s.defaultTravelRole(),
                      s.activityCategory(),
                      s.activityPlace().publicAreaLabel()))
          .toList();
    } catch (RuntimeException error) {
      throw mapped(error);
    }
  }

  @GetMapping("/{id}")
  @Operation(operationId = "getSchedule")
  public ScheduleResponse get(Principal actor, @PathVariable String id) {
    try {
      return response(schedules.get(actor.getName(), id), List.of());
    } catch (RuntimeException error) {
      throw mapped(error);
    }
  }

  public record MatchRequest(
      @Min(0) double radiusKm, @Min(0) int timeWindowMinutes, @NotNull TravelRole targetRole) {}

  public record FriendIntentResponse(
      String ownerUserId,
      LocalDate localDate,
      ScheduleDirection direction,
      TravelRole travelRole,
      Instant earliestDepartureAt,
      Instant arrivalDeadlineAt,
      String originPublicArea,
      String destinationPublicArea) {}

  public record MatchResponse(
      List<FriendScheduleResponse> schedules,
      List<FriendIntentResponse> intents) {}

  @PostMapping("/{id}/match")
  @Operation(operationId = "matchSchedules")
  public MatchResponse match(
      Principal actor, @PathVariable String id, @Valid @RequestBody MatchRequest request) {
    try {
      ScheduleService.MatchResult result = schedules.match(
          actor.getName(),
          id,
          request.radiusKm(),
          request.timeWindowMinutes(),
          request.targetRole());
          
      List<FriendScheduleResponse> matchedSchedules = result.schedules().stream()
          .map(s -> new FriendScheduleResponse(
              s.ownerUserId(), s.weekdays(), s.effectiveFrom(), s.effectiveUntil(),
              s.startLocalTime(), s.endLocalTime(), s.directions(), s.defaultTravelRole(),
              s.activityCategory(), s.activityPlace().publicAreaLabel()))
          .toList();

      List<FriendIntentResponse> matchedIntents = result.intents().stream()
          .map(i -> new FriendIntentResponse(
              i.ownerUserId(), i.localDate(), i.direction(), i.travelRole(),
              i.earliestDepartureAt(), i.arrivalDeadlineAt(),
              i.origin().publicAreaLabel(), i.destination().publicAreaLabel()))
          .toList();

      return new MatchResponse(matchedSchedules, matchedIntents);
    } catch (RuntimeException error) {
      throw mapped(error);
    }
  }

  @PutMapping("/{id}")
  @Operation(operationId = "replaceSchedule")
  public ScheduleResponse replace(
      Principal actor,
      @PathVariable String id,
      @RequestHeader("If-Match") String ifMatch,
      @Valid @RequestBody RuleRequest request) {
    try {
      ScheduleRule saved =
          schedules.replace(actor.getName(), id, version(ifMatch), command(request));
      return response(saved, checkWarnings(actor.getName(), saved, saved.effectiveFrom()));
    } catch (RuntimeException error) {
      throw mapped(error);
    }
  }

  @DeleteMapping("/{id}")
  @Operation(operationId = "endSchedule")
  public ScheduleResponse end(
      Principal actor, @PathVariable String id, @RequestHeader("If-Match") String ifMatch) {
    return changeStatus(actor, id, ifMatch, ScheduleStatus.ENDED);
  }

  @PostMapping("/{id}/pause")
  @Operation(operationId = "pauseSchedule")
  public ScheduleResponse pause(
      Principal actor, @PathVariable String id, @RequestHeader("If-Match") String ifMatch) {
    return changeStatus(actor, id, ifMatch, ScheduleStatus.PAUSED);
  }

  @PostMapping("/{id}/resume")
  @Operation(operationId = "resumeSchedule")
  public ScheduleResponse resume(
      Principal actor, @PathVariable String id, @RequestHeader("If-Match") String ifMatch) {
    return changeStatus(actor, id, ifMatch, ScheduleStatus.ACTIVE);
  }

  @PutMapping("/{id}/exceptions/{date}")
  @Operation(operationId = "upsertScheduleException")
  public ExceptionResponse upsertException(
      Principal actor,
      @PathVariable String id,
      @PathVariable LocalDate date,
      @Valid @RequestBody ExceptionRequest request) {
    try {
      ScheduleException saved =
          schedules.upsertException(
              actor.getName(),
              id,
              date,
              new ExceptionCommand(
                  request.type(),
                  request.startLocalTime(),
                  request.endLocalTime(),
                  request.activityPlaceRef(),
                  request.usualOriginRef(),
                  request.directions(),
                  request.version()));
      return exceptionResponse(
          saved, checkWarnings(actor.getName(), schedules.get(actor.getName(), id), date));
    } catch (RuntimeException error) {
      throw mapped(error);
    }
  }

  @DeleteMapping("/{id}/exceptions/{date}")
  @Operation(operationId = "deleteScheduleException")
  public void deleteException(
      Principal actor,
      @PathVariable String id,
      @PathVariable LocalDate date,
      @RequestHeader("If-Match") String ifMatch) {
    try {
      schedules.deleteException(actor.getName(), id, date, version(ifMatch));
    } catch (RuntimeException error) {
      throw mapped(error);
    }
  }

  @GetMapping("/{id}/conflicts")
  @Operation(operationId = "listScheduleConflicts")
  public List<ScheduleService.Conflict> conflicts(
      Principal actor,
      @PathVariable String id,
      @RequestParam LocalDate from,
      @RequestParam LocalDate to) {
    try {
      return schedules.conflicts(actor.getName(), id, from, to);
    } catch (RuntimeException error) {
      throw mapped(error);
    }
  }

  private ScheduleResponse changeStatus(
      Principal actor, String id, String ifMatch, ScheduleStatus status) {
    try {
      return response(schedules.status(actor.getName(), id, version(ifMatch), status), List.of());
    } catch (RuntimeException error) {
      throw mapped(error);
    }
  }

  private RuleCommand command(RuleRequest request) {
    return new RuleCommand(
        request.name(),
        request.activityCategory(),
        request.weekdays(),
        request.effectiveFrom(),
        request.effectiveUntil(),
        request.startLocalTime(),
        request.endLocalTime(),
        request.zoneId(),
        request.activityPlaceRef(),
        request.usualOriginRef(),
        request.arrivalBufferMinutes(),
        request.directions(),
        request.defaultTravelRole(),
        request.visibility());
  }

  private ScheduleResponse response(ScheduleRule value, List<ScheduleService.Conflict> warnings) {
    return new ScheduleResponse(
        value.id(),
        value.name(),
        value.activityCategory(),
        value.weekdays(),
        value.effectiveFrom(),
        value.effectiveUntil(),
        value.startLocalTime(),
        value.endLocalTime(),
        value.zoneId(),
        place(value.activityPlace()),
        place(value.usualOrigin()),
        value.arrivalBufferMinutes(),
        value.directions(),
        value.defaultTravelRole(),
        value.visibility(),
        value.status(),
        value.version(),
        warnings);
  }

  private ExceptionResponse exceptionResponse(
      ScheduleException value, List<ScheduleService.Conflict> warnings) {
    return new ExceptionResponse(
        value.id(),
        value.localDate(),
        value.type(),
        value.startLocalTime(),
        value.endLocalTime(),
        place(value.activityPlace()),
        place(value.usualOrigin()),
        value.directions(),
        value.version(),
        warnings);
  }

  private PlaceView place(PlaceSnapshot value) {
    return value == null
        ? null
        : new PlaceView(
            value.displayLabel(), value.publicAreaLabel(), value.longitude(), value.latitude());
  }

  private List<ScheduleService.Conflict> checkWarnings(
      String ownerUserId, ScheduleRule rule, LocalDate fromDate) {
    if (rule.status() != ScheduleStatus.ACTIVE) return List.of();
    LocalDate today = LocalDate.now(clock.withZone(java.time.ZoneId.of(rule.zoneId())));
    LocalDate from = fromDate.isBefore(today) ? today : fromDate;
    if (rule.effectiveUntil() != null && from.isAfter(rule.effectiveUntil())) return List.of();
    LocalDate to = from.plusDays(13);
    if (rule.effectiveUntil() != null && to.isAfter(rule.effectiveUntil())) {
      to = rule.effectiveUntil();
    }
    return schedules.conflicts(ownerUserId, rule.id(), from, to);
  }

  private long version(String value) {
    try {
      return Long.parseLong(value.replace("\"", "").strip());
    } catch (RuntimeException invalid) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "INVALID_VERSION", "Phiên bản dữ liệu không hợp lệ");
    }
  }

  private ApiException mapped(RuntimeException error) {
    if (error instanceof ApiException api) return api;
    if (error instanceof ScheduleService.ScheduleNotFoundException) {
      return new ApiException(HttpStatus.NOT_FOUND, "SCHEDULE_NOT_FOUND", "Không tìm thấy lịch");
    }
    if (error instanceof OptimisticLockingFailureException) {
      return new ApiException(
          HttpStatus.CONFLICT, "VERSION_CONFLICT", "Lịch đã thay đổi, vui lòng tải lại");
    }
    if (error instanceof ScheduleService.ScheduleAccessDeniedException) {
      return new ApiException(
          HttpStatus.FORBIDDEN, "SCHEDULE_ACCESS_DENIED", "Tài khoản chưa được xác minh");
    }
    if (error instanceof ScheduleService.ScheduleDriverRequiredException) {
      return new ApiException(
          HttpStatus.FORBIDDEN, "DRIVER_APPROVAL_REQUIRED", "Cần quyền tài xế để lưu lịch này");
    }
    if (error instanceof ScheduleService.PlaceReferenceExpiredException) {
      return new ApiException(
          HttpStatus.CONFLICT, "PLACE_REFERENCE_EXPIRED", "Địa điểm đã hết hạn, vui lòng chọn lại");
    }
    if (error instanceof IllegalArgumentException
        || error instanceof ScheduleService.InvalidScheduleException) {
      return new ApiException(
          HttpStatus.UNPROCESSABLE_ENTITY, "SCHEDULE_INVALID", "Dữ liệu lịch không hợp lệ");
    }
    throw error;
  }
}
