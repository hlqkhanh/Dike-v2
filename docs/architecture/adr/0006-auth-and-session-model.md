# 0006 — Auth and session model

- Status: Accepted
- Date: 2026-10-05

## Context

Dike serves a browser and Flutter clients, starts with Google identity and requires phone verification before production pilot.

## Decision

Use Google OIDC authorization code flow with PKCE, state and nonce validation. Backend-owned opaque sessions are stored server-side. Web receives Secure, HttpOnly, SameSite cookies with CSRF/origin protection. Flutter uses a mobile-appropriate opaque token stored in OS secure storage. OTP verifies phone ownership before pilot access.

## Alternatives

- Long-lived self-contained JWT as the only session: rejected because revocation and device logout are harder.
- Client-owned Google tokens as application authorization: rejected because Dike needs its own account, roles and session lifecycle.
- Shared browser cookie in mobile: rejected because native clients have different storage and redirect boundaries.

## Consequences

Session issuance, rotation, per-device revoke and global logout are backend responsibilities. Web and mobile share policy but use different credential transport.

## Validation

Security tests cover OIDC state/nonce, fixation, CSRF, expiry, revoke, device logout, account linking and OTP rate limits.

## Revisit triggers

Review when adding another identity provider, enterprise SSO or a machine-to-machine API.
