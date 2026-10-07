package com.dike.planning.api;

import com.dike.planning.application.TravelIntentService;
import com.dike.planning.domain.PlaceSnapshot;
import com.dike.planning.domain.ScheduleDirection;
import com.dike.planning.domain.TravelIntent;
import com.dike.planning.domain.TravelIntentCommitmentState;
import com.dike.planning.domain.TravelIntentSourceType;
import com.dike.planning.domain.TravelRole;
import com.dike.shared.api.ApiException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.security.Principal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/travel-intents")
@SecurityRequirement(name = "sessionCookie")
public class TravelIntentController {

  private final TravelIntentService intents;

  public TravelIntentController(TravelIntentService intents) {
    this.intents = intents;
  }

  public record ManualIntentRequest(
      @NotNull LocalDate localDate,
      @NotNull ScheduleDirection direction,
      @NotNull TravelRole travelRole,
      @NotBlank String originPlaceRef,
      @NotBlank String destinationPlaceRef,
      Instant earliestDepartureAt,
      Instant arrivalDeadlineAt) {}

  public record PlaceView(
      String displayLabel, String publicAreaLabel, double longitude, double latitude) {}

  public record IntentResponse(
      String id,
      TravelIntentSourceType sourceType,
      String scheduleId,
      LocalDate localDate,
      ScheduleDirection direction,
      TravelRole travelRole,
      PlaceView origin,
      PlaceView destination,
      Instant earliestDepartureAt,
      Instant arrivalDeadlineAt,
      TravelIntentCommitmentState commitmentState,
      boolean sourceChanged,
      long version) {}

  @GetMapping
  @Operation(operationId = "listTravelIntents")
  public List<IntentResponse> list(
      Principal actor, @RequestParam LocalDate from, @RequestParam LocalDate to) {
    return intents.list(actor.getName(), from, to).stream().map(this::map).toList();
  }

  @GetMapping("/{id}")
  @Operation(operationId = "getTravelIntent")
  public IntentResponse get(Principal actor, @PathVariable String id) {
    return map(intents.get(actor.getName(), id));
  }

  @PostMapping
  @Operation(operationId = "createManualTravelIntent")
  public IntentResponse create(
      Principal actor,
      @Valid @RequestBody ManualIntentRequest request,
      @RequestHeader("Idempotency-Key") String key) {
    return map(
        intents.createManual(
            actor.getName(),
            new TravelIntentService.CreateManual(
                request.localDate(),
                request.direction(),
                request.travelRole(),
                request.originPlaceRef(),
                request.destinationPlaceRef(),
                request.earliestDepartureAt(),
                request.arrivalDeadlineAt()),
            key));
  }

  @PutMapping("/{id}")
  @Operation(operationId = "replaceManualTravelIntent")
  public IntentResponse replace(
      Principal actor,
      @PathVariable String id,
      @RequestHeader("If-Match") String ifMatch,
      @Valid @RequestBody ManualIntentRequest request) {
    return map(
        intents.replaceManual(
            actor.getName(),
            id,
            version(ifMatch),
            new TravelIntentService.CreateManual(
                request.localDate(),
                request.direction(),
                request.travelRole(),
                request.originPlaceRef(),
                request.destinationPlaceRef(),
                request.earliestDepartureAt(),
                request.arrivalDeadlineAt())));
  }

  @DeleteMapping("/{id}")
  @Operation(operationId = "cancelTravelIntent")
  public IntentResponse cancel(Principal actor, @PathVariable String id) {
    return map(intents.cancel(actor.getName(), id));
  }

  @PostMapping("/{id}/match")
  @Operation(operationId = "requestMatchIntent")
  public IntentResponse requestMatch(Principal actor, @PathVariable String id) {
    return map(intents.requestMatch(actor.getName(), id));
  }

  private IntentResponse map(TravelIntent intent) {
    return new IntentResponse(
        intent.id(),
        intent.sourceType(),
        intent.scheduleId(),
        intent.localDate(),
        intent.direction(),
        intent.travelRole(),
        mapPlace(intent.origin()),
        mapPlace(intent.destination()),
        intent.earliestDepartureAt(),
        intent.arrivalDeadlineAt(),
        intent.commitmentState(),
        intent.sourceChanged(),
        intent.version());
  }

  private PlaceView mapPlace(PlaceSnapshot place) {
    if (place == null) return null;
    return new PlaceView(
        place.displayLabel(), place.publicAreaLabel(), place.longitude(), place.latitude());
  }

  private long version(String ifMatch) {
    if (ifMatch == null || ifMatch.isBlank())
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "If-Match header is required");
    try {
      return Long.parseLong(ifMatch.replace("\"", ""));
    } catch (NumberFormatException e) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "If-Match must be a numeric version");
    }
  }
}
