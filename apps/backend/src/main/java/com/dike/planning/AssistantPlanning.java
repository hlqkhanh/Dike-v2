package com.dike.planning;

import com.dike.planning.application.*;
import com.dike.planning.domain.*;
import com.dike.shared.api.ApiException;
import com.dike.shared.application.AtomicCommands;
import java.time.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/** Public planning facade. Model output never bypasses normal planning authorization. */
@Service
public class AssistantPlanning {
  private final ScheduleService schedules;
  private final TravelIntentService intents;
  private final AtomicCommands commands;
  private final Clock clock;

  public AssistantPlanning(
      ScheduleService schedules,
      TravelIntentService intents,
      AtomicCommands commands,
      Clock clock) {
    this.schedules = schedules;
    this.intents = intents;
    this.commands = commands;
    this.clock = clock;
  }

  @io.swagger.v3.oas.annotations.media.Schema(name = "AssistantConfirmationResult")
  public record Result(String id, String kind, List<String> warnings) {}

  public Result confirm(
      String actor,
      String draftId,
      String kind,
      Map<String, String> f,
      String originRef,
      String destinationRef) {
    try {
      LocalDate date = LocalDate.parse(required(f, "date"));
      if (date.isBefore(LocalDate.now(clock.withZone(ZoneId.of(ScheduleRule.V1_ZONE)))))
        throw new IllegalArgumentException("Ngày đã qua; hãy chọn lại ngày áp dụng.");
      TravelRole role = TravelRole.valueOf(required(f, "role"));
      if (role == TravelRole.UNKNOWN)
        throw new IllegalArgumentException("Chọn vai trò đi ké hoặc tài xế.");
      if ("SCHEDULE".equals(kind)) {
        var command =
            new ScheduleService.RuleCommand(
                required(f, "name"),
                ActivityCategory.valueOf(required(f, "category")),
                days(required(f, "weekdays")),
                date,
                LocalDate.parse(required(f, "until")),
                LocalTime.parse(required(f, "startTime")),
                LocalTime.parse(required(f, "endTime")),
                ScheduleRule.V1_ZONE,
                destinationRef,
                originRef,
                Integer.parseInt(f.getOrDefault("buffer", "10")),
                directions(required(f, "directions")),
                role,
                ScheduleVisibility.PRIVATE);
        // Receipt and schedule/outbox commit together. A draft has exactly one creation key.
        String id =
            commands.execute(
                actor,
                "assistant-schedule",
                draftId,
                "SCHEDULE",
                () -> schedules.create(actor, command).id());
        var saved = schedules.get(actor, id);
        LocalDate to =
            saved.effectiveUntil().isBefore(saved.effectiveFrom().plusDays(30))
                ? saved.effectiveUntil()
                : saved.effectiveFrom().plusDays(30);
        var warnings =
            schedules.conflicts(actor, id, saved.effectiveFrom(), to).stream()
                .map(c -> "Trùng lịch ngày " + c.localDate())
                .distinct()
                .toList();
        return new Result(id, kind, warnings);
      }
      if (!"INTENT".equals(kind)) throw new IllegalArgumentException("Loại bản nháp không hợp lệ.");
      ZoneId zone = ZoneId.of(ScheduleRule.V1_ZONE);
      Instant departure =
          date.atTime(LocalTime.parse(required(f, "departureTime"))).atZone(zone).toInstant();
      Instant arrival = departure.plus(Duration.ofHours(2));
      if (departure.isBefore(clock.instant()))
        throw new IllegalArgumentException("Giờ đi chưa được qua.");
      var command =
          new TravelIntentService.CreateManual(
              date,
              ScheduleDirection.OUTBOUND,
              role,
              originRef,
              destinationRef,
              departure,
              arrival);
      String id =
          commands.execute(
              actor,
              "assistant-intent",
              draftId,
              "INTENT",
              () -> intents.createManual(actor, command, draftId).id());
      return new Result(id, kind, List.of());
    } catch (ScheduleService.ScheduleAccessDeniedException e) {
      throw new ApiException(
          HttpStatus.FORBIDDEN, "SCHEDULE_ACCESS_DENIED", "Tài khoản chưa được xác minh.");
    } catch (ScheduleService.ScheduleDriverRequiredException e) {
      throw new ApiException(
          HttpStatus.FORBIDDEN, "DRIVER_APPROVAL_REQUIRED", "Cần quyền tài xế để lưu lịch này.");
    } catch (ScheduleService.PlaceReferenceExpiredException e) {
      throw new ApiException(
          HttpStatus.CONFLICT,
          "PLACE_REFERENCE_EXPIRED",
          "Địa chỉ đã hết hạn. Hãy tìm và chọn lại hai địa chỉ.");
    } catch (ScheduleService.InvalidScheduleException e) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST,
          "SCHEDULE_INVALID",
          "Lịch chưa hợp lệ. Hãy kiểm tra lại thời gian và ngày áp dụng.");
    } catch (IllegalArgumentException e) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "ASSISTANT_INVALID_DRAFT", e.getMessage());
    }
  }

  private static String required(Map<String, String> fields, String key) {
    String value = fields.get(key);
    if (value == null || value.isBlank())
      throw new IllegalArgumentException("Còn thiếu trường: " + key);
    return value.strip();
  }

  private static Set<DayOfWeek> days(String value) {
    Set<DayOfWeek> result = new HashSet<>();
    for (String part : value.split(",")) result.add(DayOfWeek.valueOf(part.strip()));
    return result;
  }

  private static Set<ScheduleDirection> directions(String value) {
    Set<ScheduleDirection> result = new HashSet<>();
    for (String part : value.split(",")) result.add(ScheduleDirection.valueOf(part.strip()));
    return result;
  }
}
