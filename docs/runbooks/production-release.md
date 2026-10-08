# Production release runbook

## Purpose

This runbook promotes a tested Dike release candidate through staging and production.
It does not authorize pilot traffic while any gate in `plan/STAGE_17_READINESS.md` is
blocked.

## Release identity

Record before deployment:

- Git commit SHA.
- GHCR backend image tag and resolved digest.
- Vercel deployment ID.
- API client contract check result.
- Android/iOS EAS build IDs and version/build numbers, when mobile is included.
- Operator, reviewer, start time and change-ticket link.

API and worker must use the same resolved image digest. A matching mutable tag is not
sufficient evidence.

## Preconditions

1. Repository, Maven, browser/mobile E2E and security gates are green.
2. Stage 17 readiness has no release-blocking item marked `BLOCKED`.
3. Backup/PITR is healthy and the latest restore drill is within the accepted window.
4. No unresolved critical/high security finding or active severity-1 incident exists.
5. Production provider quota, support owner and rollback operator are available.
6. Database/index changes are backward compatible with the currently supported web and
   mobile versions.

## Staging promotion

1. Run the `Release candidate` workflow for the selected commit and publish its
   commit-addressed image.
2. Resolve the image to a digest and pin both Render API and worker to that digest.
3. Set `DIKE_SERVICE_VERSION` to the full commit SHA. Keep API/worker environment values
   identical except `SPRING_PROFILES_ACTIVE` and `DIKE_WORKLOAD`.
4. Deploy worker, then API, and confirm both report the expected version in structured
   logs.
5. Deploy the matching Vercel build.
6. Run `corepack pnpm smoke:deployment -- https://staging-api.example.com`.
7. Run the critical E2E journey and inspect auth, HTTP, Mongo, Redis, outbox, WebSocket
   and provider dashboards for the observation window.

## Production promotion

1. Capture explicit production approval and freeze unrelated deployments.
2. Confirm production guards: OTP required, fake OTP/routing disabled, simulated driver
   access disabled, HTTPS/WSS origins allowlisted and secure `__Host-` cookie enabled.
3. Promote the exact staging backend digest and Vercel artifact; do not rebuild.
4. Run backward-compatible migration/index steps before switching traffic.
5. Deploy worker, API and web in the compatibility order documented in the change.
6. Run deployment smoke and one synthetic read-only journey.
7. Observe error rate, p95 latency, auth, outbox oldest age and worker heartbeat before
   releasing the next pilot cohort.

## Rollback

Rollback immediately for identity spoofing, data/location exposure, capacity invariant
violation, sustained error budget breach or inability to process the outbox.

1. Stop cohort expansion and activate the relevant server-side kill switch.
2. Pin API and worker back to the last known-good digest.
3. Restore the last known-good Vercel deployment.
4. Do not reverse a database migration unless its tested rollback is explicitly safe;
   otherwise forward-fix while old application versions remain compatible.
5. Re-run smoke checks and verify outbox/worker recovery.
6. Open an incident record and preserve logs, release identities and timeline.

Mobile binaries cannot be recalled immediately. Keep the backend compatible and use
minimum-version policy or kill switches only under the approved incident procedure.
