package com.dike.planning.application;

import com.dike.planning.JourneySources;
import com.dike.planning.PostAccounts;
import com.dike.planning.domain.TravelIntentCommitmentState;
import com.dike.shared.api.ApiException;
import com.dike.shared.application.AtomicCommands;
import java.time.*;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class PostSourceService {
  private final PlanningStore store;
  private final JourneySources journeys;
  private final PostSourceBindings bindings;
  private final PostAccounts accounts;
  private final AtomicCommands commands;
  private final Clock clock;

  public PostSourceService(
      PlanningStore store,
      JourneySources journeys,
      PostSourceBindings bindings,
      PostAccounts accounts,
      AtomicCommands commands,
      Clock clock) {
    this.store = store;
    this.journeys = journeys;
    this.bindings = bindings;
    this.accounts = accounts;
    this.commands = commands;
    this.clock = clock;
  }

  @io.swagger.v3.oas.annotations.media.Schema(name = "PostSourceChoice")
  public record Choice(
      String id,
      long version,
      String originLabel,
      String destinationLabel,
      Instant departureAt,
      Instant arrivalAt) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "PostSourceChoices")
  public record Choices(List<Choice> items) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "PostSourceBind")
  public record Bind(long version, String routeId) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "PostSourceCreate")
  public record Create(String routeId, Instant departureAt, Instant arrivalAt) {}

  public com.dike.planning.JourneySources.Intent create(String actor, Create input, String key) {
    active(actor);
    String id =
        commands.execute(
            actor,
            "post.source",
            key,
            input.toString(),
            () -> bindings.create(actor, input.routeId(), input.departureAt(), input.arrivalAt()));
    return journeys
        .intent(actor, id)
        .orElseThrow(
            () ->
                new ApiException(
                    HttpStatus.CONFLICT, "SOURCE_ROUTE_CHANGED", "Vui lòng chọn lại tuyến đường"));
  }

  public Choices choices(String actor) {
    active(actor);
    var today = LocalDate.now(clock.withZone(ZoneId.of("Asia/Ho_Chi_Minh")));
    return new Choices(
        store.intents(actor, today, today.plusDays(7)).stream()
            .filter(
                i ->
                    i.commitmentState() == TravelIntentCommitmentState.PRIVATE
                        && i.travelRole() == com.dike.planning.domain.TravelRole.RIDER)
            .map(
                i ->
                    new Choice(
                        i.id(),
                        i.version(),
                        i.origin().publicAreaLabel(),
                        i.destination().publicAreaLabel(),
                        i.earliestDepartureAt(),
                        i.arrivalDeadlineAt()))
            .toList());
  }

  public com.dike.planning.JourneySources.Intent bind(
      String actor, String id, Bind input, String key) {
    active(actor);
    commands.execute(
        actor,
        "post.prepare",
        key,
        id + ":" + input,
        () -> {
          commands.fence("intent", id);
          bindings.bind(actor, id, input.version(), input.routeId());
          return id;
        });
    return journeys
        .intent(actor, id)
        .orElseThrow(
            () ->
                new ApiException(
                    HttpStatus.CONFLICT, "SOURCE_ROUTE_CHANGED", "Vui lòng chọn lại tuyến đường"));
  }

  private void active(String actor) {
    if (!accounts.verified(actor))
      throw new ApiException(
          HttpStatus.FORBIDDEN, "VERIFICATION_REQUIRED", "Cần xác minh tài khoản");
  }
}
