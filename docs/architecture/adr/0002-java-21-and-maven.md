# 0002 — Java 21 and Maven

- Status: Accepted
- Date: 2026-10-05

## Context

The backend needs a supported LTS runtime and reproducible builds across Windows, Linux and CI without relying on a globally installed Maven version.

## Decision

Use vendor-neutral Java 21 and Maven Wrapper 3.9.10. CI uses Eclipse Temurin 21. The root parent POM enforces Java 21 and Maven 3.9.x and locks plugin versions.

## Alternatives

- Newer non-LTS Java: rejected due to shorter support horizon.
- Gradle: viable but rejected to minimize build-language complexity and align with team choice.
- System Maven only: rejected because it is not reproducible.

## Consequences

Developers may use any conforming JDK vendor. Wrapper scripts and Enforcer fail early on unsupported runtimes.

## Validation

`./mvnw -B -ntp verify` succeeds on Java 21 and fails on a different Java major version.

## Revisit triggers

Review for the next Java LTS or when a Spring Boot baseline no longer supports Java 21/Maven 3.9.x.
