package com.dike.ride.infrastructure;

import com.dike.ride.RideResources;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/** Local/test-only vehicles for the driver journey before real vehicle approval exists. */
@Component
@ConditionalOnProperty(name = "dike.identity.simulated-full-access-enabled", havingValue = "true")
class SimulatedRideResources implements RideResources {

  static final String MOTORCYCLE_ID = "simulated:motorcycle";
  static final String CAR_ID = "simulated:car";

  private final long minimumContribution;
  private final long maximumContribution;

  SimulatedRideResources(
      Environment environment,
      @Value("${dike.planning.contribution.minimum-per-km-vnd:500}") long minimumContribution,
      @Value("${dike.planning.contribution.maximum-per-km-vnd:10000}") long maximumContribution) {
    String current = environment.getProperty("dike.environment", "local");
    if (!"local".equals(current) && !"test".equals(current)) {
      throw new IllegalStateException(
          "Simulated vehicles are restricted to local and test environments");
    }
    this.minimumContribution = minimumContribution;
    this.maximumContribution = maximumContribution;
  }

  @Override
  public boolean available() {
    return true;
  }

  @Override
  public Optional<Vehicle> vehicle(String actor, String id) {
    return switch (id) {
      case MOTORCYCLE_ID -> Optional.of(new Vehicle(id, actor, "MOTORCYCLE", 1, 1));
      case CAR_ID -> Optional.of(new Vehicle(id, actor, "CAR", 3, 1));
      default -> Optional.empty();
    };
  }

  @Override
  public Optional<Quote> quote(String actor, String id) {
    return Optional.empty();
  }

  @Override
  public boolean contributionAllowed(Vehicle vehicle, long perKm) {
    return isSimulated(vehicle.id())
        && perKm >= minimumContribution
        && perKm <= maximumContribution;
  }

  @Override
  public void fenceVehicle(String id, long approvalVersion) {
    if (!isSimulated(id) || approvalVersion != 1) {
      throw new IllegalStateException("Simulated vehicle changed");
    }
  }

  private boolean isSimulated(String id) {
    return MOTORCYCLE_ID.equals(id) || CAR_ID.equals(id);
  }
}
