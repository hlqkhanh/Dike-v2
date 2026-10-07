package com.dike.planning.domain;

public record RoutePoint(double longitude, double latitude) {
  public RoutePoint {
    if (!Double.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new IllegalArgumentException("Invalid route longitude");
    }
    if (!Double.isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw new IllegalArgumentException("Invalid route latitude");
    }
  }
}
