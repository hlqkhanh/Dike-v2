# 0008 — Deployment topology

- Status: Accepted
- Date: 2026-10-05

## Context

The pilot needs a low-operations deployment that preserves separate web, synchronous API and background worker scaling without introducing microservices.

## Decision

Deploy Next.js web to Vercel. Build one Spring backend image and run the same version as API and worker profiles on Render. Use MongoDB Atlas, a Redis-compatible Render service and Cloudflare R2. Environments have separate databases, buckets, OAuth clients and secrets.

## Alternatives

- Kubernetes: rejected at pilot scale due to operational cost.
- One process for HTTP and background jobs: rejected because failure and scaling characteristics differ.
- Multiple backend services/codebases: rejected by the modular-monolith decision.

## Consequences

API and worker releases stay synchronized. Deployment needs health checks, migration/index steps, smoke tests, rollback and environment-specific secret management.

## Validation

Stage 17 proves staging/production promotion, API/worker version parity, smoke test, rollback, backup/restore and monitoring.

## Revisit triggers

Review when availability, regional deployment, workload scale or provider constraints exceed this topology.
