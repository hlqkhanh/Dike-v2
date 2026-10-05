# 0003 — MongoDB primary store

- Status: Accepted
- Date: 2026-10-05

## Context

Dike stores evolving profile, planning, community, trip and messaging documents, while booking requires atomic state transitions.

## Decision

MongoDB Atlas is the production primary store. Local and test use a MongoDB replica set. Booking consistency uses Spring Data MongoDB transactions through `MongoTransactionManager`; indexes are managed as explicit migrations.

## Alternatives

- PostgreSQL/PostGIS: not selected for the current implementation; geospatial providers remain behind adapters.
- Standalone local MongoDB: rejected because it cannot validate production-like transaction behaviour.

## Consequences

Document ownership aligns with modules, but cross-document transaction scope must stay small. Replica-set infrastructure and transaction rollback tests are mandatory.

## Validation

Stage 1 integration tests prove rollback, unique/index constraints and replica-set parity using Testcontainers.

## Revisit triggers

Review if measured query patterns, reporting, relational integrity or geospatial requirements cannot be met safely and economically.
