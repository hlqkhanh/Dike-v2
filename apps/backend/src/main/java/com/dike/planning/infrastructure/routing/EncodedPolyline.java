package com.dike.planning.infrastructure.routing;

import com.dike.planning.domain.RoutePoint;
import java.util.ArrayList;
import java.util.List;

final class EncodedPolyline {

  private EncodedPolyline() {}

  static List<RoutePoint> decode(String encoded) {
    if (encoded == null || encoded.isBlank()) return List.of();
    List<RoutePoint> points = new ArrayList<>();
    int index = 0;
    int latitude = 0;
    int longitude = 0;
    while (index < encoded.length()) {
      Decoded lat = decodeValue(encoded, index);
      index = lat.nextIndex();
      Decoded lng = decodeValue(encoded, index);
      index = lng.nextIndex();
      latitude += lat.delta();
      longitude += lng.delta();
      points.add(new RoutePoint(longitude / 1e5, latitude / 1e5));
    }
    return List.copyOf(points);
  }

  private static Decoded decodeValue(String encoded, int start) {
    int result = 0;
    int shift = 0;
    int index = start;
    int value;
    do {
      if (index >= encoded.length() || shift > 30) {
        throw new IllegalArgumentException("Malformed encoded polyline");
      }
      value = encoded.charAt(index++) - 63;
      result |= (value & 0x1f) << shift;
      shift += 5;
    } while (value >= 0x20);
    int delta = (result & 1) != 0 ? ~(result >> 1) : result >> 1;
    return new Decoded(delta, index);
  }

  private record Decoded(int delta, int nextIndex) {}
}
