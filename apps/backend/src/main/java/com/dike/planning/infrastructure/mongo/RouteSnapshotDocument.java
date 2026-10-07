package com.dike.planning.infrastructure.mongo;

import com.dike.planning.domain.RoutePoint;
import com.dike.planning.domain.VehicleMode;
import java.time.Instant;
import java.util.List;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("route_snapshots")
record RouteSnapshotDocument(
    @Id String id,
    String ownerUserId,
    String provider,
    String providerRouteId,
    VehicleMode vehicleMode,
    PlaceDocument origin,
    PlaceDocument destination,
    long distanceMeters,
    long durationSeconds,
    List<RoutePoint> geometry,
    Instant calculatedAt,
    Instant expiresAt,
    long version) {}
