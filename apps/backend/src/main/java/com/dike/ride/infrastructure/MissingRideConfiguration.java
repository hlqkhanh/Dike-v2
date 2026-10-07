package com.dike.ride.infrastructure;

import com.dike.ride.RideResources;
import com.dike.shared.api.ApiException;
import java.util.Optional;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpStatus;

@Configuration(proxyBeanMethods = false)
class MissingRideConfiguration {
  @Bean
  @ConditionalOnMissingBean(RideResources.class)
  RideResources unavailableRideResources() {
    return new RideResources() {
      public Optional<Vehicle> vehicle(String actor, String id) {
        return Optional.empty();
      }

      public Optional<Quote> quote(String actor, String id) {
        return Optional.empty();
      }

      public boolean contributionAllowed(Vehicle vehicle, long perKm) {
        return false;
      }

      public void fenceVehicle(String id, long version) {
        throw new ApiException(
            HttpStatus.SERVICE_UNAVAILABLE,
            "VEHICLE_SOURCE_UNAVAILABLE",
            "Chưa có dữ liệu xe được duyệt");
      }
    };
  }
}
