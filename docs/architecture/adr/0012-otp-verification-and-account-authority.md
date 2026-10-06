# 0012 — OTP verification and account authority

- Status: Proposed
- Date: 2026-10-06

## Context

Dike must verify ownership of Vietnamese mobile numbers before granting pilot
capabilities. Verification must remain safe under retries, concurrent requests,
multiple browser sessions, provider timeouts and horizontal API scaling. SMS is a
delivery channel, not proof of legal identity and not phishing-resistant MFA.

The existing Google OIDC login and opaque server-side session remain the only login
mechanism. Stage 3 adds phone verification and server-derived authorities without
creating a second identity or session system.

## Decision

- Dike generates six-digit OTP values with a cryptographically secure random source.
  The provider transports the message and never owns Dike's verification state.
- MongoDB is the source of truth for account phone state, challenge lifecycle,
  idempotency records, durable daily send budget and verification audit outbox.
  Account verification and challenge consumption commit in one transaction.
- Redis atomically reserves short-window limits independently for user, canonical
  phone key, device session and trusted client IP. OTP issue and verify fail closed
  when the limiter is unavailable.
- OTP values are never persisted or logged in plaintext. Challenges store a
  versioned HMAC bound to challenge, user, phone version, purpose and generation.
  Phone correlation and rate-limit keys use a separate keyed HMAC.
- A partial unique MongoDB index on canonical phone applies only to `VERIFIED`
  accounts. That index is the final arbiter when two accounts race to verify the
  same number.
- `MEMBER` and `VERIFIED_MEMBER` are derived on each request from current account
  state. `APPROVED_DRIVER`, `MODERATOR` and `ADMIN` are server-assigned values;
  assignment alone cannot bypass prerequisites or resource privacy policy.
- Changing a verified phone requires a Google re-authentication no older than five
  minutes. A real phone change increments phone and authorization versions, removes
  verification evidence and invalidates prior challenges. Submitting the same
  canonical number is a no-op.
- Fake delivery exists only in local/test, produces `SIMULATED` evidence and is not
  exposed through production API responses or logs. Hosted environments fail at
  startup when fake delivery, bypass mode or required key material is configured
  unsafely.
- The first admin is provisioned only by an offline, idempotent command requiring an
  explicit account ID, operator and reason, with dry-run and audit output. No web
  onboarding request can assign a privileged role.
- SMS vendor selection is intentionally separate from this architecture decision.
  A hosted adapter may be enabled only after its sandbox demonstrates bounded
  timeout, idempotent dispatch, redacted errors and explicit accepted/rejected/
  unknown outcomes.

## Alternatives

- Provider-managed OTP challenges were rejected because mixing provider and Dike
  state makes authorization, replay handling and vendor replacement ambiguous.
- Plain hashes of OTP values or phone numbers were rejected because both input
  spaces are small enough for inexpensive offline enumeration.
- Redis-only verification or daily budgets were rejected because restart, eviction
  or failover must not grant authority or reset the cost ceiling.
- A single combined rate-limit key was rejected because attackers could distribute
  attempts across users, devices or IP addresses.
- Self-service role fields and an implicit `ADMIN` role hierarchy were rejected
  because they allow mass assignment and bypass resource-level privacy policy.

## Consequences

Verification requires MongoDB transactions and a Redis primary. Provider calls occur
outside MongoDB transactions, so timeout has an explicit unknown state and cannot be
retried blindly. Key rotation needs versioned peppers and a bounded compatibility
window. The system must maintain more state and failure-injection tests, but it gains
single-use verification, deterministic retries and immediate authority revocation.

SMS vendor onboarding and real-number acceptance remain release gates; the fake
adapter is sufficient only for local and automated tests.

## Validation

- Integration tests prove the partial unique index exists and blocks two verified
  accounts while allowing duplicate unverified candidates.
- Transaction and barrier-based tests cover consume/user/outbox atomicity, duplicate
  verification, final-attempt races, resend/verify and phone-change races.
- Security tests cover owner/device binding, immediate role downgrade, CSRF/origin,
  locked accounts and SecurityContext isolation.
- Environment tests prove hosted startup rejects fake/bypass/missing peppers.
- Provider contract tests prove timeout/idempotency/error mapping without logging OTP
  values, phone numbers or provider payloads.
- Browser tests cover Google login, issue, wrong code, resend, success, reload, 429,
  offline/unknown delivery and phone change.

## Revisit triggers

Create a superseding ADR before using provider-managed challenges, Redis Cluster,
non-SMS verification, phone login, password recovery, phishing-resistant admin MFA
or more than one active OTP delivery provider.
