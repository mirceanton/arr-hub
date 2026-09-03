# Integration test stack

`docker-compose.test.yml` stands up real Sonarr/Radarr/Lidarr/Bazarr, Keycloak, and
Postgres containers for integration testing arr-hub against actual APIs (no mocks).

Start it with:

```sh
docker compose -f docker-compose.test.yml up -d
```

Containers are left running after setup — do not `docker compose down` unless you
intend to tear the stack down and re-derive keys/credentials below.

## Containers

| Service  | Container name          | Image                                     | Host port | Config volume    |
|----------|--------------------------|--------------------------------------------|-----------|-------------------|
| Sonarr   | `arr-hub-test-sonarr`   | `lscr.io/linuxserver/sonarr:latest`       | 8989      | `sonarr_config`  |
| Radarr   | `arr-hub-test-radarr`   | `lscr.io/linuxserver/radarr:latest`       | 7878      | `radarr_config`  |
| Lidarr   | `arr-hub-test-lidarr`   | `lscr.io/linuxserver/lidarr:latest`       | 8686      | `lidarr_config`  |
| Bazarr   | `arr-hub-test-bazarr`   | `lscr.io/linuxserver/bazarr:latest`       | 6767      | `bazarr_config`  |
| Keycloak | `arr-hub-test-keycloak` | `quay.io/keycloak/keycloak:latest`        | 8080      | n/a (dev mode, in-memory H2) |
| Postgres | `arr-hub-test-postgres` | `postgres:16`                             | 5433 → 5432 in-container | n/a (named-volume-free; ephemeral container storage) |

All *arr services run PUID=1000, PGID=1000, TZ=UTC.

## Re-deriving API keys / credentials

### Sonarr / Radarr / Lidarr

The API key is auto-generated on first boot into `/config/config.xml` inside each
container. Re-derive with:

```sh
docker exec arr-hub-test-sonarr cat /config/config.xml   # <ApiKey>...</ApiKey>
docker exec arr-hub-test-radarr cat /config/config.xml
docker exec arr-hub-test-lidarr cat /config/config.xml
```

If the file doesn't exist yet (first boot can take a few seconds), retry in a loop:

```sh
until docker exec arr-hub-test-sonarr test -f /config/config.xml; do sleep 2; done
```

Keys extracted this session:

| Service | API key                            |
|---------|-------------------------------------|
| Sonarr  | `23252660f7d14e3984d5148b6a2b13ee` |
| Radarr  | `44c0ad12352b4305bbfc459da25613ef` |
| Lidarr  | `f421a088907643af9e5a37f2e5e3017f` |

**API shape deviation:** Sonarr and Radarr both use `/api/v3/...`. **Lidarr uses
`/api/v1/...`** — `/api/v3/system/status` 404s on Lidarr; `/api/v1/system/status`
is correct. Verified:

```sh
curl -s -H "X-Api-Key: 23252660f7d14e3984d5148b6a2b13ee" http://localhost:8989/api/v3/system/status   # Sonarr
curl -s -H "X-Api-Key: 44c0ad12352b4305bbfc459da25613ef" http://localhost:7878/api/v3/system/status   # Radarr
curl -s -H "X-Api-Key: f421a088907643af9e5a37f2e5e3017f" http://localhost:8686/api/v1/system/status   # Lidarr (note v1, not v3)
```

All three returned 200 with a flat, camelCase JSON body, e.g. Sonarr:

```json
{
  "appName": "Sonarr", "instanceName": "Sonarr", "version": "4.0.19.2979",
  "isDocker": true, "authentication": "none", "urlBase": "",
  "databaseType": "sqLite", "packageAuthor": "[linuxserver.io](https://linuxserver.io)",
  "packageUpdateMechanism": "docker", ...
}
```

Radarr and Lidarr responses have the same shape (appName/version/instanceName/etc),
just with their own version numbers and `branch: master` (vs. Sonarr's `main`).

### Bazarr

Bazarr's config lives at a **different path and format** than the other three:
`/config/config/config.yaml` (YAML, not XML), with the key under `auth.apikey`:

```sh
docker exec arr-hub-test-bazarr cat /config/config/config.yaml | grep -A3 '^auth:'
```

Key extracted this session: `c027d3342e667929be9908ecfcfa69c9`

**API shape deviation:** Bazarr's REST API is meaningfully different from the
Sonarr/Radarr/Lidarr family:

- No version prefix — it's `/api/...`, not `/api/v3/...` or `/api/v1/...`.
- Auth header is the same (`X-Api-Key: <key>`), and a `?apikey=` query param also
  works.
- Response bodies are wrapped in a `"data"` object and use `snake_case` fields,
  not Sonarr/Radarr/Lidarr's flat camelCase.

Status endpoint and response:

```sh
curl -s -H "X-Api-Key: c027d3342e667929be9908ecfcfa69c9" http://localhost:6767/api/system/status
```

```json
{"data": {"bazarr_version": "1.6.0", "package_version": "v1.6.0-ls362 by linuxserver.io",
  "sonarr_version": "", "radarr_version": "", "operating_system": "Linux-6.12.76-linuxkit-aarch64-with",
  "python_version": "3.12.14", "database_engine": "Sqlite 3.53.4", "database_migration": "unknown",
  "bazarr_directory": "/app/bazarr/bin", "bazarr_config_directory": "/config",
  "start_time": 1788441578.047251, "timezone": "UTC", "cpu_cores": 10}}
```

There's also a lightweight `/api/badges` endpoint (episode/movie/provider counters,
signalr connection status) that may be useful for a quick health check:

```sh
curl -s -H "X-Api-Key: c027d3342e667929be9908ecfcfa69c9" http://localhost:6767/api/badges
# {"episodes": 0, "movies": 0, "providers": 0, "status": 1, "sonarr_signalr": "DOWN", "radarr_signalr": "DOWN", "announcements": 5}
```

Bazarr's client in the app should NOT reuse the Sonarr/Radarr/Lidarr HTTP client
as-is — at minimum, the base path (no `/v3`) and response envelope (`data.*`,
snake_case) need their own parsing.

### Keycloak

Admin console: `admin` / `admin` (env `KEYCLOAK_ADMIN` / `KEYCLOAK_ADMIN_PASSWORD` —
Keycloak logs these as deprecated in favor of `KC_BOOTSTRAP_ADMIN_USERNAME` /
`KC_BOOTSTRAP_ADMIN_PASSWORD`, but they still work and created the temp admin user).

**Gotcha:** Keycloak 26's default `sslRequired` policy is `EXTERNAL`, meaning any
request that doesn't look like it originates from localhost must use HTTPS. Because
requests from the Docker host arrive at the container via the Docker bridge gateway
(not literally `127.0.0.1` from Keycloak's point of view), plain `curl
http://localhost:8080/realms/master/.well-known/openid-configuration` from the host
returns `403 {"error":"invalid_request","error_description":"HTTPS required"}`. This
is why the `homelab` realm below is explicitly created with `sslRequired=NONE` — do
the same for any additional realm you want reachable over plain HTTP from the host.

Realm/client/user were created via `kcadm.sh` inside the container, authenticated
with the admin credentials against the container's own `localhost:8080` (which
Keycloak does treat as local, sidestepping the HTTPS-required issue for the CLI
itself):

```sh
docker exec arr-hub-test-keycloak /opt/keycloak/bin/kcadm.sh config credentials \
  --server http://localhost:8080 --realm master --user admin --password admin

docker exec arr-hub-test-keycloak /opt/keycloak/bin/kcadm.sh create realms \
  -s realm=homelab -s enabled=true -s sslRequired=NONE

docker exec arr-hub-test-keycloak /opt/keycloak/bin/kcadm.sh create clients -r homelab \
  -s clientId=arr-hub -s enabled=true -s publicClient=false -s protocol=openid-connect \
  -s 'redirectUris=["http://localhost:3000/api/auth/callback/keycloak"]' \
  -s 'webOrigins=["http://localhost:3000"]' \
  -s standardFlowEnabled=true -s directAccessGrantsEnabled=true \
  -s secret=arr-hub-dev-secret -i

docker exec arr-hub-test-keycloak /opt/keycloak/bin/kcadm.sh create users -r homelab \
  -s username=testuser -s enabled=true -s email=testuser@example.com \
  -s emailVerified=true -s firstName=Test -s lastName=User -i

docker exec arr-hub-test-keycloak /opt/keycloak/bin/kcadm.sh set-password -r homelab \
  --username testuser --new-password testpass123 --temporary=false
```

To re-derive the client secret at any time:

```sh
docker exec arr-hub-test-keycloak /opt/keycloak/bin/kcadm.sh get \
  clients/5896892b-c24d-4878-990d-941f74a16264/client-secret -r homelab
```

(or `kcadm.sh get clients -r homelab -q clientId=arr-hub` to re-discover the
client's internal id if it's ever lost).

Verified end-to-end: the well-known endpoint returns valid JSON, and `testuser` can
obtain a real access token via the password grant against the `arr-hub` client:

```sh
curl -s http://localhost:8080/realms/homelab/.well-known/openid-configuration
# {"issuer":"http://localhost:8080/realms/homelab", "authorization_endpoint": "...",
#  "token_endpoint": "http://localhost:8080/realms/homelab/protocol/openid-connect/token", ...}

curl -s -X POST http://localhost:8080/realms/homelab/protocol/openid-connect/token \
  -d client_id=arr-hub -d client_secret=arr-hub-dev-secret \
  -d grant_type=password -d username=testuser -d password=testpass123
# => 200 with a real access_token / refresh_token JWT pair
```

Keycloak realm/client/user summary:

| Field                | Value                                                            |
|-----------------------|-------------------------------------------------------------------|
| Realm                 | `homelab`                                                        |
| Issuer                | `http://localhost:8080/realms/homelab`                          |
| Client ID             | `arr-hub`                                                        |
| Client type           | confidential (`publicClient=false`)                              |
| Client secret         | `arr-hub-dev-secret`                                             |
| Redirect URI          | `http://localhost:3000/api/auth/callback/keycloak`               |
| Test user             | `testuser` / `testpass123`, email `testuser@example.com`, `temporary=false` |

### Postgres

No key to derive — just credentials from the compose file. Verified ready with:

```sh
docker exec arr-hub-test-postgres pg_isready -U arrhub -d arrhub
# => /var/run/postgresql:5432 - accepting connections

docker exec arr-hub-test-postgres psql -U arrhub -d arrhub -c "SELECT version();"
# => PostgreSQL 16.15 ...
```

Mapped to host port **5433** (container's internal 5432 is left untouched, to avoid
clashing with any host Postgres).

## `.env.test`

```env
SONARR_URL=http://localhost:8989
SONARR_API_KEY=23252660f7d14e3984d5148b6a2b13ee

RADARR_URL=http://localhost:7878
RADARR_API_KEY=44c0ad12352b4305bbfc459da25613ef

LIDARR_URL=http://localhost:8686
LIDARR_API_KEY=f421a088907643af9e5a37f2e5e3017f

BAZARR_URL=http://localhost:6767
BAZARR_API_KEY=c027d3342e667929be9908ecfcfa69c9

OIDC_ISSUER_URL=http://localhost:8080/realms/homelab
OIDC_CLIENT_ID=arr-hub
OIDC_CLIENT_SECRET=arr-hub-dev-secret

DATABASE_URL=postgresql://arrhub:arrhub@localhost:5433/arrhub
```

Note: `LIDARR_URL` + `LIDARR_API_KEY` are correct as a base URL, but the Lidarr
HTTP client needs to call `/api/v1/...` on that base, not `/api/v3/...` like the
Sonarr/Radarr clients — see the deviation note above. Similarly, a `BAZARR_URL`-based
client needs `/api/...` with no version segment and must unwrap the `data` envelope.

## Notes / deviations from the original plan

- `LIDARR` uses API path prefix `/api/v1/` instead of `/api/v3/` (Sonarr/Radarr use v3).
- `BAZARR` config is YAML at `/config/config/config.yaml` (key at `auth.apikey`), not
  XML — and its API has no version prefix, wraps responses in `{"data": {...}}`, and
  uses snake_case fields. It cooperated fine (no flakiness encountered).
- Keycloak's `KEYCLOAK_ADMIN`/`KEYCLOAK_ADMIN_PASSWORD` env vars are deprecated
  (superseded by `KC_BOOTSTRAP_ADMIN_USERNAME`/`KC_BOOTSTRAP_ADMIN_PASSWORD`) but
  still functional as of `keycloak:latest` (26.7.3).
- Keycloak's default `sslRequired=EXTERNAL` blocks plain-HTTP requests to
  `http://localhost:8080/realms/<realm>/...` from the host (Docker port-forwarding
  makes Keycloak see a non-local client IP). Worked around by setting
  `sslRequired=NONE` on the `homelab` realm at creation time. The `master` realm
  still has the default and will 403 on HTTP from the host — that's expected and
  doesn't affect the `homelab` realm arr-hub actually uses.
- Postgres has no named volume (ephemeral container storage) since the task only
  needs it to boot and accept connections for later dual-dialect testing — data
  durability across container recreation isn't required. Ports are 5433 (host) →
  5432 (container) as specified, to avoid clashing with a host-installed Postgres.
