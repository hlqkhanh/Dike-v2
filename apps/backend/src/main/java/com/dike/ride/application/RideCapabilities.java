package com.dike.ride.application;

import com.dike.planning.JourneySources;
import com.dike.ride.RideResources;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class RideCapabilities {
  private final JourneySources journeys;
  private final RideResources resources;
  private final boolean boardingReady;

  public RideCapabilities(
      JourneySources journeys,
      RideResources resources,
      @Value("${dike.ride.boarding-key:}") String key) {
    this.journeys = journeys;
    this.resources = resources;
    boolean valid;
    try {
      valid = java.util.Base64.getDecoder().decode(key).length == 32;
    } catch (IllegalArgumentException invalid) {
      valid = false;
    }
    boardingReady = valid;
  }

  @io.swagger.v3.oas.annotations.media.Schema(name = "RideCapabilities")
  public record View(boolean posting, boolean trips, boolean proposals, String message) {}

  public View view() {
    boolean posts = journeys.available(), trips = posts && resources.available();
    boolean proposals = trips && boardingReady;
    return new View(
        posts,
        trips,
        proposals,
        proposals
            ? "Sẵn sàng"
            : "Tính năng tạo chuyến và ghép chuyến đang được chuẩn bị. Bạn vẫn có thể xem dữ liệu đã có.");
  }
}
