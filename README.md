# Arr Hub

A single self-hosted web app that unifies Sonarr, Radarr, and Lidarr (with
Bazarr along for the ride) behind one login, one permission model, and one
UI. Non-admins search and request; admins approve and manage. Built for a
household/homelab, not as a product — plain env-var config, no admin-UI
service wiring, no feature flags.

## Stack

- **Next.js** (App Router) — one process, API routes as the backend-for-frontend.
- **Drizzle ORM**, dual dialect — SQLite or Postgres, selected at runtime from `DATABASE_URL`.
- **openid-client** against your Keycloak realm — the frontend never sees an OIDC token or an *arr API key.
- **Zod** for env parsing and API boundaries.
- **Pino** for structured JSON logs to stdout.
- **shadcn/ui** (dark theme).

## Adding a service

Media service clients are a small registry, not scattered `if` checks:

- `src/env.ts` — `SERVICE_IDS` lists the service and its env-var prefix.
- `src/lib/services/<service>/client.ts` — a class implementing `MediaServiceClient` (`src/lib/services/types.ts`). Only `healthCheck` is required; `search`/`addItem`/`getQueue`/`getCalendar` are opt-in per what the service actually supports.
- `src/lib/services/registry.ts` — one entry in `SERVICE_DEFINITIONS`.

That's it — nav, the dashboard, search, and the request/approval flow all read from the registry, not from a hardcoded service list. A service with no URL/API key configured is simply absent from the registry.

## Local development

```bash
cp .env.example .env.local   # fill in real values — SQLite is the easy default
npm install
npm run db:migrate           # applies drizzle/sqlite or drizzle/postgres depending on DATABASE_URL
npm run dev
```

Every required env var is validated by `src/env.ts` at boot with Zod — the
process exits with a clear message if something's missing or malformed. A
service's `<PREFIX>_URL`/`<PREFIX>_API_KEY` pair is optional, but both or
neither must be set.

## Testing

```bash
npm run test              # unit tests — pure logic, mocked HTTP (msw), no external services
npm run test:integration  # hits real local services — see below
```

`npm run test:integration` expects the stack in `docker-compose.test.yml` to
be running (real Sonarr/Radarr/Lidarr/Bazarr/Keycloak/Postgres containers —
see `docker-compose.test.md` for how to bring it up and re-derive API keys)
and `.env.local` populated from that file's `.env.test` block. It covers:

- Health/search/add-then-remove against each real *arr service.
- Webhook payloads captured from each service's real `/notification/test` endpoint.
- OIDC provisioning against the real Keycloak (fresh user → default role; group-mapped user → mapped role).
- A migration diff: same table/column shape on a fresh SQLite file and a fresh Postgres database.

## Database

```bash
npm run db:generate:sqlite     # after changing src/lib/db/schema/sqlite.ts
npm run db:generate:postgres   # after changing src/lib/db/schema/postgres.ts
npm run db:migrate             # applies whichever dialect DATABASE_URL points at
```

The two schema files are kept in sync by hand (Drizzle's `sqliteTable` and
`pgTable` are genuinely different APIs — there's no single dialect-agnostic
schema definition). Application code never imports either schema file
directly; it goes through `src/lib/db/repository.ts`, which is the one
place that's dialect-aware.

## Docker

```bash
docker build -t arr-hub .
docker run -p 3000:3000 \
  -e DATABASE_URL=file:/data/app.db \
  -e SESSION_SECRET=... \
  -e OIDC_ISSUER_URL=... -e OIDC_CLIENT_ID=... -e OIDC_CLIENT_SECRET=... -e OIDC_REDIRECT_URI=... \
  -e SONARR_URL=... -e SONARR_API_KEY=... \
  -v arr-hub-data:/data \
  arr-hub
```

The container runs migrations automatically on start, then `next start`. The
same image works with `DATABASE_URL=postgres://...` — no rebuild needed.
Secrets (`SESSION_SECRET`, the OIDC client secret, every service's API key)
should come from your orchestrator's secret store (e.g. a Kubernetes
`Secret`, not a `ConfigMap`) — the app itself just reads env vars.

## Known gaps in this pass

- **Shelfmark** (book requests) is out of scope for this pass — the
  registry is built so it can be added later without touching existing
  services.
- **Lidarr's real "import complete" webhook event name** is a best-effort
  guess (`Download`/`ReleaseImport`/`AlbumImport` are all accepted) —
  producing a real completed import needs an actual indexer + download
  client, which wasn't available to verify against. Sonarr's and Radarr's
  event names (`Download`) are verified against real captured payloads.
- **Keycloak RP-initiated logout** destroys the app's own session
  correctly, but doesn't silently redirect back to `/login` — it lands on
  Keycloak's own logged-out page first, because that requires passing
  `id_token_hint` to the end-session endpoint and the app doesn't currently
  retain the id_token after login.
