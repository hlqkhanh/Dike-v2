# Cloudflare Workers trial

Trial URL: <https://dike-web-trial.ho-so-dao-chieu.workers.dev>

This deploys the web application only. Spring Boot continues to run at
`https://dike-api-demo.onrender.com`. No Containers, R2, Images, KV, or database
subscriptions were provisioned. The existing `ho-so-dao-chieu` Worker is separate.

## Build and deploy

From the repository root, with dependencies installed and Wrangler authenticated:

```powershell
pnpm --filter @dike/web build:vinext
pnpm --filter @dike/web exec wrangler deploy --config dist/server/wrangler.json
```

`vite.config.ts` defaults to the existing demo backend and demo notice. Override
`DIKE_API_INTERNAL_ORIGIN` and `DIKE_WEB_DEMO` before building to change them;
keep the runtime variables in `wrangler.jsonc` consistent. The Wrangler account
ID is specific to the account used for this trial.

The usual `dev`, `build`, and `start` scripts still use Next.js. vinext requires
React, React DOM, and React Server DOM Webpack 19.3.1 or later; the web package
uses 19.3.1. Vite deduplicates React across workspace packages. Unit tests have
a separate config so they do not start the Cloudflare runtime.

The two build tools share generated `.next/types` files. If type checking after
a vinext build, run `pnpm --filter @dike/web exec next typegen` first.

## Large model asset

The original GLB is 65,164,016 bytes, above the Workers per-file limit. The build
script writes four smaller binary assets into `dist/client/model-parts` and
excludes the original from upload. `cloudflare-entry.mjs` streams them in order
at the original model URL without changing the viewer or source model. Its
Content-Length comes from the source model size at build time. Always rebuild
before deploying a changed model; do not deploy unprepared client assets.

## Verified and remaining work

The trial returned HTTP 200 for `/` and `/login`, and HTTP 401 for an
unauthenticated `/api/v1/auth/session`. Google authorization redirects reach
Google, but the existing backend still supplies this callback:

```text
https://dike-v2.vercel.app/api/v1/auth/callback/google
```

Login entirely on the Worker domain is not configured. Before using this as the
main frontend, configure its Google authorized origin/callback and the backend
frontend URL, OAuth callback, auth origin, and realtime origin settings. Coordinate
those changes with the backend account owner to preserve the existing Vercel demo.
No backend settings or Google OAuth settings were changed by this trial.

Browser automation was unavailable in this session; validation used builds,
TypeScript, unit tests, and HTTP checks. Full authenticated user flows still need
browser testing after OAuth is configured.

## Undo

The trial has not been committed or pushed. To undo locally, restore this trial's
changes to `apps/web/package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml`,
remove its added config/entry/test/build-script/runbook files, and reinstall
dependencies. Preserve any later independent edits. Local rollback does not
remove the hosted Worker; remove or roll back `dike-web-trial` separately in
Cloudflare if desired. The earlier Git stash is unaffected.
