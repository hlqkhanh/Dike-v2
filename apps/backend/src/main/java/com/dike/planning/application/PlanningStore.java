package com.dike.planning.application;

import com.dike.planning.domain.RouteSnapshot;
import com.dike.planning.domain.ScheduleDirection;
import com.dike.planning.domain.ScheduleException;
import com.dike.planning.domain.ScheduleRule;
import com.dike.planning.domain.TravelIntent;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface PlanningStore {

  ScheduleRule insertSchedule(ScheduleRule schedule);

  Optional<ScheduleRule> schedule(String scheduleId);

  List<ScheduleRule> schedules(String ownerUserId);

  List<ScheduleRule> schedules(List<String> ownerUserIds);

  List<ScheduleRule> activeSchedules();

  ScheduleRule replaceSchedule(ScheduleRule before, ScheduleRule after);

  ScheduleException insertException(ScheduleException exception);

  Optional<ScheduleException> exception(String scheduleId, LocalDate localDate);

  List<ScheduleException> exceptions(String scheduleId, LocalDate from, LocalDate to);

  ScheduleException replaceException(ScheduleException before, ScheduleException after);

  void deleteException(ScheduleException exception);

  TravelIntent insertIntent(TravelIntent intent);

  Optional<TravelIntent> intent(String intentId);

  Optional<TravelIntent> scheduledIntent(
      String scheduleId, LocalDate localDate, ScheduleDirection direction);

  List<TravelIntent> intents(String ownerUserId, LocalDate from, LocalDate to);

  List<TravelIntent> activeIntents();

  TravelIntent replaceIntent(TravelIntent before, TravelIntent after);

  RouteSnapshot insertRoute(RouteSnapshot route);

  Optional<RouteSnapshot> route(String routeId);
}
