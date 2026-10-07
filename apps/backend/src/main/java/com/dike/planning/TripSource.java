package com.dike.planning;

import java.time.Instant;
import java.util.Optional;

/** Read port implemented by ride; avoids a planning -> ride -> planning module cycle. */
public interface TripSource {
  record Offer(
      String id,
      String ownerId,
      String status,
      long version,
      long termsVersion,
      String visibility,
      String communityId,
      String originLabel,
      String destinationLabel,
      Instant departureAt,
      int remainingSeats,
      long contributionPerKm,
      String vehicleType,
      String routeId) {}

  Optional<Offer> offer(String id);
}
