# 0004 — WebSocket/STOMP

- Status: Accepted
- Date: 2026-10-05

## Context

Chat, presence and trip updates need low-latency delivery, but realtime transport must not become an alternate source of truth.

## Decision

REST is the authoritative state interface. Spring WebSocket with STOMP delivers realtime notifications; clients reconnect and reconcile through REST. Authorization applies at connection, subscription and message boundaries.

## Alternatives

- Socket.IO: rejected because the Spring backend has native STOMP support and protocol ownership should stay explicit.
- WebSocket as the state source: rejected because reconnect and audit semantics would be fragile.
- Polling only: rejected for chat and active trip latency.

## Consequences

Clients must handle missed/duplicate messages and perform REST reconciliation. Redis Pub/Sub may later fan out ephemeral signals across API instances.

## Validation

Tests cover unauthorized subscription, duplicate delivery, reconnect and REST reconciliation.

## Revisit triggers

Review if protocol interoperability, fan-out scale or delivery guarantees exceed STOMP and Redis capabilities.
