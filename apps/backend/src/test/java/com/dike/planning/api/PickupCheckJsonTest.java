package com.dike.planning.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.dike.planning.application.PickupCompatibilityService;
import com.dike.planning.application.RidePostResponseService;
import com.dike.shared.api.GlobalExceptionHandler;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class PickupCheckJsonTest {
  @ParameterizedTest
  @ValueSource(
      strings = {
        "{}",
        "{\"pickupPlaceRef\":\"resolved-pickup\"}",
        "{\"dropoffPlaceRef\":\"resolved-dropoff\"}",
        "{\"pickupPlaceRef\":\"resolved-pickup\",\"dropoffPlaceRef\":\"resolved-dropoff\"}",
        "{\"passengerRouteId\":\"owned-route\"}",
        "{\"useDriverPickup\":null,\"useDriverDropoff\":null}",
        "{\"useDriverPickup\":false,\"useDriverDropoff\":false}"
      })
  void omittedOrNullFlagsDefaultToFalse(String body) throws Exception {
    assertFlags(body, false, false);
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "{\"passengerRouteId\":\"owned-route\",\"useDriverPickup\":true}",
        "{\"passengerRouteId\":\"owned-route\",\"useDriverPickup\":true,\"useDriverDropoff\":false}"
      })
  void explicitPickupOverrideIsPreserved(String body) throws Exception {
    assertFlags(body, true, false);
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "{\"passengerRouteId\":\"owned-route\",\"useDriverDropoff\":true}",
        "{\"passengerRouteId\":\"owned-route\",\"useDriverPickup\":false,\"useDriverDropoff\":true}"
      })
  void explicitDropoffOverrideIsPreserved(String body) throws Exception {
    assertFlags(body, false, true);
  }

  private void assertFlags(String body, boolean pickup, boolean dropoff) throws Exception {
    var pickups = mock(PickupCompatibilityService.class);
    var mvc =
        MockMvcBuilders.standaloneSetup(
                new RidePostResponseController(mock(RidePostResponseService.class), pickups))
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
    mvc.perform(
            post("/api/v1/ride-posts/post/pickup-checks")
                .principal(() -> "passenger")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isOk());
    var input = ArgumentCaptor.forClass(PickupCompatibilityService.Input.class);
    verify(pickups).check(eq("passenger"), eq("post"), input.capture());
    assertThat(input.getValue().useDriverPickup()).isEqualTo(pickup);
    assertThat(input.getValue().useDriverDropoff()).isEqualTo(dropoff);
  }
}
