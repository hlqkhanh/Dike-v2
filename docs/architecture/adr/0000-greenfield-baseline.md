# 0000 — Greenfield baseline

- Status: Accepted
- Date: 2026-10-05

## Context

Prototype source and demo data were intentionally removed. Treating an unavailable prototype as a migration source would create unverifiable compatibility and privacy obligations.

## Decision

Dike starts from an empty greenfield repository. Source, data and Git history from the prototype are not restored, imported or migrated. Local/test data is newly generated synthetic data. No prototype, legacy or release tag is created during Stage 0.

## Alternatives

- Restore source from backups: rejected because it is outside the agreed scope and provenance cannot be validated.
- Recreate demo data: rejected because it may reproduce personal data or hidden assumptions.

## Consequences

The team can design clean boundaries without backward compatibility. Useful behaviour must be recovered from the master plan, not old artifacts. No migration script is required.

## Validation

Repository history starts with the greenfield baseline; tracked-file and secret scans show no prototype artifact, dump, upload or PII.

## Revisit triggers

Only a separately authorized legal or audit requirement can trigger a new decision about archived material; it must not be merged into the application history by default.
