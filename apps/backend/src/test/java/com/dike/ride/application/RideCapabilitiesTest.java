package com.dike.ride.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.dike.identity.IdentityAccess;
import com.dike.planning.JourneySources;
import com.dike.ride.RideResources;
import java.util.Base64;
import org.junit.jupiter.api.Test;

class RideCapabilitiesTest {

  @Test
  void normalizesLegacyNullEvidenceToRestrictedAccess() {
    var access = new IdentityAccess.Access("member", true, true, false, null, 0);

    assertThat(access.driverEvidence()).isEqualTo(IdentityAccess.DriverEvidence.NONE);
    assertThat(access.accessMode()).isEqualTo(IdentityAccess.AccessMode.RESTRICTED);
  }

  @Test
  void exposesSimulatedVehiclesOnlyToSimulatedApprovedDriver() {
    var journeys = mock(JourneySources.class);
    var resources = mock(RideResources.class);
    var identities = mock(IdentityAccess.class);
    when(journeys.available()).thenReturn(true);
    when(resources.available()).thenReturn(true);
    when(identities.require("driver"))
        .thenReturn(
            new IdentityAccess.Access(
                "driver",
                true,
                true,
                true,
                false,
                false,
                false,
                IdentityAccess.DriverEvidence.SIMULATED,
                IdentityAccess.AccessMode.SIMULATED,
                1));

    var key = Base64.getEncoder().encodeToString(new byte[32]);
    var view = new RideCapabilities(journeys, resources, identities, key).view("driver");

    assertThat(view.canCreateTrip()).isTrue();
    assertThat(view.canManageBookings()).isTrue();
    assertThat(view.accessMode()).isEqualTo("SIMULATED");
    assertThat(view.vehicles())
        .extracting(RideCapabilities.VehicleView::id)
        .containsExactly("simulated:motorcycle", "simulated:car");
    assertThat(view.vehicles())
        .extracting(RideCapabilities.VehicleView::passengerCapacity)
        .containsExactly(1, 3);
  }

  @Test
  void doesNotExposeSimulatedVehiclesToRealDriver() {
    var journeys = mock(JourneySources.class);
    var resources = mock(RideResources.class);
    var identities = mock(IdentityAccess.class);
    when(journeys.available()).thenReturn(true);
    when(resources.available()).thenReturn(true);
    when(identities.require("driver"))
        .thenReturn(
            new IdentityAccess.Access(
                "driver",
                true,
                true,
                true,
                false,
                false,
                false,
                IdentityAccess.DriverEvidence.REAL,
                IdentityAccess.AccessMode.REAL,
                1));

    var view = new RideCapabilities(journeys, resources, identities, "").view("driver");

    assertThat(view.accessMode()).isEqualTo("REAL");
    assertThat(view.vehicles()).isEmpty();
  }
}
