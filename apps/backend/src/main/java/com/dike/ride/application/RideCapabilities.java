package com.dike.ride.application;

import com.dike.identity.IdentityAccess;
import com.dike.planning.JourneySources;
import com.dike.ride.RideResources;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class RideCapabilities {
  private final JourneySources journeys;
  private final RideResources resources;
  private final IdentityAccess identities;
  private final boolean boardingReady;

  @org.springframework.beans.factory.annotation.Autowired
  public RideCapabilities(
      JourneySources journeys,
      RideResources resources,
      IdentityAccess identities,
      @Value("${dike.ride.boarding-key:}") String key) {
    this.journeys = journeys;
    this.resources = resources;
    this.identities = identities;
    boolean valid;
    try {
      valid = java.util.Base64.getDecoder().decode(key).length == 32;
    } catch (IllegalArgumentException invalid) {
      valid = false;
    }
    boardingReady = valid;
  }

  RideCapabilities(JourneySources journeys, RideResources resources, String key) {
    this(journeys, resources, null, key);
  }

  public record VehicleView(
      String id, String type, String displayName, int passengerCapacity, String evidence) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "RideCapabilities")
  public record View(
      boolean posting,
      boolean trips,
      boolean proposals,
      boolean canCreateTrip,
      boolean canManageBookings,
      String accessMode,
      List<VehicleView> vehicles,
      String message) {}

  public View view(String actor) {
    boolean posts = journeys.available();
    boolean trips = posts && resources.available();
    boolean proposals = trips && boardingReady;
    var access = identities.require(actor);
    boolean driver = access.approvedDriver();
    List<VehicleView> vehicles =
        driver && access.accessMode() == IdentityAccess.AccessMode.SIMULATED
            ? List.of(
                new VehicleView(
                    "simulated:motorcycle", "MOTORCYCLE", "Xe máy thử nghiệm", 1, "SIMULATED"),
                new VehicleView("simulated:car", "CAR", "Ô tô thử nghiệm", 3, "SIMULATED"))
            : List.of();
    return new View(
        posts,
        trips,
        proposals,
        driver && trips,
        driver && trips,
        access.accessMode().name(),
        vehicles,
        proposals
            ? "Sẵn sàng"
            : "Tính năng tạo chuyến và ghép chuyến đang được chuẩn bị. Bạn vẫn có thể xem dữ liệu đã có.");
  }

  View view() {
    boolean posts = journeys.available();
    boolean trips = posts && resources.available();
    boolean proposals = trips && boardingReady;
    return new View(
        posts,
        trips,
        proposals,
        false,
        false,
        "RESTRICTED",
        List.of(),
        proposals ? "Sẵn sàng" : "Chưa sẵn sàng");
  }
}
