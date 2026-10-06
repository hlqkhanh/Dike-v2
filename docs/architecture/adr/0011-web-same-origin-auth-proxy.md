# 0011 — Web same-origin authentication proxy

- Status: Accepted
- Date: 2026-10-06

## Context

The Next.js web is deployed on Vercel and the Spring Boot API on Render. Calling
Render directly from a Vercel page makes the web session cookie cross-site and
dependent on `SameSite=None`, credentialed CORS and browser third-party-cookie
policy. A successful Google callback could therefore create a session that later
browser API requests do not send reliably.

## Decision

Browser traffic uses the Next.js origin and reserves `/api/*` as a reverse proxy
to the configured Spring Boot upstream. Google authorization and callback routes
also pass through this origin. The browser session cookie is first-party,
`HttpOnly`, `SameSite=Lax` and `Secure` outside local HTTP development.

Next.js performs transport only. Spring Security owns OAuth2/OIDC, PKCE, state,
nonce, CSRF, session lifecycle and authorization. Spring Boot remains the only
business backend. Flutter will call Spring directly with its mobile credential
transport.

## Alternatives

- Direct Vercel-to-Render browser calls with `SameSite=None`: rejected because
  session availability would depend on third-party-cookie behavior and more
  fragile CORS/CSRF configuration.
- Wait for sibling custom domains: rejected because it would block Stage 2 and
  preview/staging authentication.
- Implement authentication in Next.js: rejected because it would split identity
  and session ownership across two backends.

## Consequences

- Web code uses relative `/api/...` URLs and avoids credentialed cross-site fetch
  as its default path.
- OAuth public redirect URIs point to the web origin; trusted forwarded headers or
  an explicit public base URL are required in Spring.
- Vercel adds one network hop and must not cache authenticated responses, retry
  mutations or become an open proxy.
- The Spring API must still secure direct requests; the proxy is not an
  authorization boundary.

## Validation

- Browser E2E completes OIDC through the proxy and remains authenticated after a
  reload.
- Cookie attribute, CSRF/origin, invalid state/nonce/PKCE and log-redaction tests
  pass.
- Proxy tests prove correct cookie/header forwarding, no auth caching and a fixed
  upstream.

## Revisit triggers

- Web and API move to sibling custom domains and measured latency justifies
  direct browser access.
- Vercel proxy limits conflict with required request size, streaming or latency.
- Authentication moves to a dedicated gateway through a new ADR.
