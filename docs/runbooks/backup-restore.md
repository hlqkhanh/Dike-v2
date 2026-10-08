# Backup and restore drill

## Safety rules

- Never restore over production.
- Restore into an isolated Atlas project/database and isolated object-storage prefix.
- Use synthetic or approved redacted validation data.
- Do not copy Redis sessions, OTP data or live-location keys into the drill environment.

## Target and evidence

Before the drill record the approved RPO/RTO, backup timestamp, operator, isolated
target, application commit and expected record counts/checksums. Atlas PITR and R2
versioning/lifecycle settings must be captured without credentials.

## Procedure

1. Select a recovery point inside the approved RPO.
2. Restore MongoDB into the isolated target and restrict network access to drill
   operators.
3. Restore referenced R2 objects into an isolated bucket/prefix when object recovery is
   part of the scenario.
4. Start API/worker using recovery-only credentials and outbound providers disabled.
5. Verify schema/index migrations without allowing worker side effects to external
   systems.
6. Check representative users, trips, bookings, messages, notifications, reviews,
   outbox receipts, audit records and file references.
7. Confirm Redis loss degrades sessions/cache/realtime safely and does not remove the
   durable business records above.
8. Record actual RPO/RTO, missing/corrupt references, follow-up owner and due date.
9. Destroy isolated restored data according to the drill retention policy.

The drill passes only when integrity checks pass and the measured RPO/RTO fit the pilot
decision. A provider dashboard showing “backup enabled” is not restore evidence.
