# 0007 — Cloudflare R2 object storage

- Status: Accepted
- Date: 2026-10-05

## Context

Dike stores public avatars and sensitive verification/vehicle files. Application containers must remain stateless and local development must not depend on production storage.

## Decision

Use Cloudflare R2 through an S3-compatible adapter in production and MinIO locally. Separate public and private buckets/prefixes. Private objects are accessed only through short-lived signed URLs after authorization; metadata and ownership remain in MongoDB.

## Alternatives

- Container filesystem: rejected because it is ephemeral and not horizontally safe.
- Public URLs for all files: rejected due to PII and access-control risk.
- Provider-specific SDK throughout domain code: rejected to preserve testability and portability.

## Consequences

Upload validation, malware scanning strategy, retention and object/database cleanup need explicit workflows. Credentials remain environment secrets.

## Validation

Integration tests use the S3-compatible adapter and verify authorization, expiry, content restrictions and private-object isolation.

## Revisit triggers

Review if residency, compliance, scanning, egress cost or reliability requirements cannot be met by R2.
