package com.dike.ride.infrastructure;

import com.dike.planning.TripSource;
import com.dike.ride.application.RideStore;
import java.util.Optional;
import org.springframework.stereotype.Component;

/** Read adapter kept separate from commands to avoid a PostService/RideService bean cycle. */
@Component
public class RideTripSource implements TripSource {
  private final RideStore store;

  public RideTripSource(RideStore store) {
    this.store = store;
  }

  public Optional<Offer> offer(String id) {
    return store
        .trip(id)
        .map(
            t ->
                new Offer(
                    t.id(),
                    t.driverId(),
                    t.status().name(),
                    t.version(),
                    t.termsVersion(),
                    t.visibility(),
                    t.communityId(),
                    t.originLabel(),
                    t.destinationLabel(),
                    t.departureAt(),
                    t.remainingSeats(),
                    t.contributionPerKm(),
                    t.vehicleType(),
                    t.routeId()));
  }
}
