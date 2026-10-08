# Incident response runbook

## Severity

| Severity | Examples                                                                                                       | Initial response                                                                 |
| -------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| SEV-1    | Identity spoofing, private data/location disclosure, corrupt booking capacity, unrecoverable production outage | Stop rollout, page incident commander immediately, consider kill switch/rollback |
| SEV-2    | Material auth/provider failure, sustained elevated errors, outbox or worker stalled                            | Page service owner, freeze deployment and mitigate within the support window     |
| SEV-3    | Degraded non-critical provider or isolated user-impacting defect                                               | Track, communicate workaround and schedule correction                            |

## Response

1. Assign incident commander, operations lead, communications owner and scribe.
2. Record detection time, affected environment/version/cohort and known impact without
   copying PII into chat or tickets.
3. Contain using feature flags, cohort freeze, credential revoke or artifact rollback.
4. Preserve immutable deployment identity, relevant redacted logs and audit events.
5. Recover, run smoke/critical checks and monitor before declaring stable.
6. Notify affected users/regulators according to the approved privacy procedure.
7. Write a blameless postmortem with corrective actions, owner and due date.

Never paste tokens, OTP values, message bodies, exact coordinates or private object keys
into incident channels.
