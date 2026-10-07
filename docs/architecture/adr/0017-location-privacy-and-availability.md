# 0017 — Location privacy and availability

- Status: Accepted
- Date: 2026-10-07

## Context

Users need a map-based nearby experience before booking and exact live location during an active ride. Publishing exact coordinates too early creates avoidable safety and privacy risk.

## Decision

Driver availability and live coordinates are ephemeral Redis data. Discovery exposes a center rounded to an approximately 500-metre cell and never exposes exact coordinates. Availability expires after 60 seconds without heartbeat.

Exact location is accepted only for participants of an active booking after explicit per-user consent. It expires after 120 seconds, is rate limited and idempotent, and is delivered only to the counterpart through a user-scoped realtime destination. MongoDB stores consent receipts, not location history.

## Alternatives

- Exact pre-booking pins were rejected for privacy.
- Permanent coordinate history in MongoDB was rejected because it is unnecessary for the pilot.
- Browser-only state was rejected because it cannot support multi-device or multi-instance delivery.

## Consequences

The discovery map is intentionally approximate. Redis loss removes availability and live coordinates. Product analytics must not reconstruct individual movement history from logs.

## Validation

Tests verify blur-before-booking, TTL/staleness, consent and participant checks, update rate limits, idempotency and cross-user isolation.

## Revisit triggers

Revisit if dispatch quality needs a different cell size, legal requirements mandate retention, or a dedicated geospatial index becomes necessary.
