package com.dike.planning.infrastructure.worker;

import com.dike.planning.application.TravelIntentMaterializer;
import com.dike.shared.outbox.OutboxEvent;
import com.dike.shared.outbox.OutboxHandler;
import org.springframework.stereotype.Component;

@Component
class ScheduleMaterializationHandler implements OutboxHandler {

  private final TravelIntentMaterializer materializer;

  ScheduleMaterializationHandler(TravelIntentMaterializer materializer) {
    this.materializer = materializer;
  }

  @Override
  public String consumerName() {
    return "planning.schedule-materialization.v1";
  }

  @Override
  public String eventType() {
    return "planning.schedule.changed";
  }

  @Override
  public int payloadVersion() {
    return 1;
  }

  @Override
  public void handle(OutboxEvent event) {
    materializer.materializeHorizon(event.aggregateId());
  }
}
