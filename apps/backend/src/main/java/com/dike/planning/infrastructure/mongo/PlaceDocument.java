package com.dike.planning.infrastructure.mongo;

import java.time.Instant;

record PlaceDocument(
    String provider,
    String providerPlaceId,
    String displayLabel,
    String publicAreaLabel,
    double longitude,
    double latitude,
    Instant resolvedAt) {}
