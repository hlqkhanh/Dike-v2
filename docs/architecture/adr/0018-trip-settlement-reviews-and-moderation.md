# 0018 — Trip settlement, reviews and moderation

- Status: Accepted
- Date: 2026-10-07

## Context

The pilot does not process money but must record whether both parties agree that an offline payment happened. Reviews should limit retaliation, and moderation actions must be traceable and safe.

## Decision

Payment acknowledgement is a two-sided record derived from the server-owned booking price. A party may retract only before the counterpart acknowledges; after both acknowledge the record is locked. This is not bank verification or a wallet ledger.

Each booking allows one immutable review per participant within seven days of completion. Reviews publish when both are submitted or when the window expires. Rating summaries are recomputed from published reviews only.

Reports use one generic workflow with optimistic version checks, assignment, priority and append-only audit records. Moderator/admin authority is checked server-side. Account lock increments authorization version and enters a restricted safety mode rather than silently deleting records or history.

## Alternatives

- Treating one-sided acknowledgement as completed payment was rejected.
- Immediate first-review publication was rejected because it enables retaliation.
- Hard deletion as moderation was rejected because it destroys evidence and auditability.

## Consequences

UI wording must say “đã trả/đã nhận” rather than “đã thanh toán thành công”. Disputes remain possible and are handled through reports. Locked users retain narrowly scoped safety access for an active ride.

## Validation

Tests cover one-sided pending state, withdrawal-before-counterpart, lock-after-both, review publication timing, unique reviews, rating recomputation, report transitions, role checks and audit append-only behavior.

## Revisit triggers

Revisit before integrating a payment provider, introducing appeals/SLA automation, or changing rating aggregation policy.
