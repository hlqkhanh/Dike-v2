# 0001 — Spring Boot Modular Monolith

- Status: Accepted
- Date: 2026-10-05

## Context

The four-person team must deliver a pilot of roughly 500 users. Booking crosses Trip, RideProposal and Booking boundaries and requires strong transactional consistency.

## Decision

Build the backend as one Spring Boot Modular Monolith. Business capabilities are Spring Modulith modules with explicit APIs and owned data. API and worker are two runtime profiles of one codebase and one release, not microservices.

## Alternatives

- Microservices and Kubernetes: rejected because operational and consistency costs exceed current scale and team capacity.
- Traditional technical-layer monolith without module boundaries: rejected because it permits uncontrolled coupling.

## Consequences

Deployment and transactions remain simple while module boundaries preserve future extraction options. Modulith and ArchUnit tests become mandatory architecture checks.

## Validation

Stage 1 adds module verification, cycle checks and rules preventing controllers from accessing repositories or modules from importing another module's internals.

## Revisit triggers

Create a new ADR if independently scaled/deployed capabilities, isolated ownership, regulatory isolation or measured workload makes a module extraction materially beneficial.
