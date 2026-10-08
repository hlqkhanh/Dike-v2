package com.dike.ride.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class SimulatedRideResourcesTest {

  @Test
  void providesActorOwnedVehiclesAndEnforcesCapacityMetadata() {
    var resources =
        new SimulatedRideResources(
            new MockEnvironment().withProperty("dike.environment", "test"), 500, 10_000);

    var motorcycle = resources.vehicle("driver-1", "simulated:motorcycle").orElseThrow();
    var car = resources.vehicle("driver-1", "simulated:car").orElseThrow();

    assertThat(motorcycle.ownerId()).isEqualTo("driver-1");
    assertThat(motorcycle.passengerCapacity()).isEqualTo(1);
    assertThat(car.passengerCapacity()).isEqualTo(3);
    assertThat(resources.contributionAllowed(car, 1_000)).isTrue();
    assertThat(resources.contributionAllowed(car, 20_000)).isFalse();
    assertThat(resources.vehicle("driver-1", "vehicle-real")).isEmpty();
  }

  @Test
  void refusesHostedEnvironment() {
    assertThatThrownBy(
            () ->
                new SimulatedRideResources(
                    new MockEnvironment().withProperty("dike.environment", "production"),
                    500,
                    10_000))
        .isInstanceOf(IllegalStateException.class);
  }
}
