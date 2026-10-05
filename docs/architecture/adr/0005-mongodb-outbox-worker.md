# 0005 — MongoDB outbox worker

- Status: Accepted
- Date: 2026-10-05

## Context

Side effects such as notifications and provider calls must not be lost when a request commits, and Stage 0 deliberately avoids a message broker.

## Decision

Write domain state and `OutboxEvent` in one MongoDB transaction. A worker profile atomically claims events, applies bounded retry/backoff and invokes idempotent handlers. Delivery is at least once. API and worker share the codebase and release.

## Alternatives

- Direct side effects inside HTTP transactions: rejected because external failures would create partial outcomes.
- Kafka/RabbitMQ now: rejected because current scale does not justify the operational burden.
- In-memory queue: rejected because it is not durable.

## Consequences

Handlers require stable idempotency keys and observable retry/dead-letter behaviour. Outbox backlog and oldest age become operational metrics.

## Validation

Stage 1 tests prove atomic rollback, retry after failure, safe concurrent claim and no duplicate effect when a handler runs twice.

## Revisit triggers

Review when measured throughput, retention, multi-service fan-out or ordering requirements exceed the MongoDB outbox design.
