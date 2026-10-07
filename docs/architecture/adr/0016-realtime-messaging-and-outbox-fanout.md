# 0016 — Realtime messaging and outbox fan-out

- Status: Accepted
- Date: 2026-10-07

## Context

Messaging, notifications and live journey updates need low-latency delivery, while business state must remain recoverable when a browser or realtime node is offline. One domain event can also have several independent consumers.

## Decision

REST and MongoDB remain the source of truth. STOMP over WebSocket only delivers user-scoped hints through `/user/queue/*`. A short-lived, single-use ticket is issued to an authenticated HTTP session; only its SHA-256 digest is stored in Redis. Clients cannot publish STOMP application messages.

Realtime envelopes are relayed through an environment-scoped Redis channel so multiple API instances can deliver them. Direct and booking conversations, messages, read markers and notifications are durable MongoDB records.

The MongoDB outbox supports several named consumers per event. Delivery state is recorded per `(eventId, consumerName)` and successful consumers are not replayed when another consumer retries.

## Alternatives

- WebSocket as the source of truth was rejected because reconnects and missed frames would lose state.
- Raw session cookies in the WebSocket URL were rejected because URLs are frequently logged.
- Duplicating one outbox event per consumer was rejected because it couples producers to consumers.

## Consequences

Clients must reconcile over REST after reconnect. Redis loss can interrupt realtime delivery but cannot corrupt durable state. Consumer names are stable public identifiers and must not be renamed without a migration.

## Validation

Integration tests cover single-use ticket consumption, user-scoped delivery and outbox fan-out/idempotency. Security tests reject expired tickets, client `SEND`, unauthorized subscriptions and cross-user access.

## Revisit triggers

Revisit if Redis pub/sub throughput is insufficient, durable event replay becomes a product requirement, or horizontal scale requires a dedicated broker.
