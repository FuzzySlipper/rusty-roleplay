# Container test deployment

Task 3439 uses an isolated installed deployment at
`/home/system/rusty-roleplay-test`. Source build assets stay in this repository;
the installed directory contains only Compose/runtime configuration, bind-mounted
state, scripts, the built frontend, and test fixtures.

The stack intentionally has one application container. Rusty Crew serves both
the Angular SPA and `/v1/*`, so an nginx sidecar would add a second routing and
health boundary without adding useful behavior.

## Layout

```text
/home/system/rusty-roleplay-test/
  .env
  compose.yaml
  config/
    service.env
    service.json
    profiles/
    skills/
  data/engine/coordination.sqlite3
  site/
  scripts/
  run/
  logs/
  artifacts/
  backups/
  workspace/
```

Every mutable path is a host bind mount. There are no Docker named volumes.
SQLite is appropriate here because exactly one Crew process owns this small,
isolated test deployment. Model inference uses the host den-router at port
`18082` through Docker's `host-gateway`; Crew stores no provider secret and no
shared Crew data is mounted.

The installed `site/runtime-config.js` pins browser API calls to
`window.location.origin`. This is load-bearing: without it, the frontend's
general multi-service fallback would derive port `9347` and could accidentally
read or write the shared live service instead of this isolated port `9350`.

## Build and install

The image build consumes a clean, archived Rusty Crew checkout as a named
BuildKit context. It uses host networking during the frontend dependency step
because `@rusty-view/*` packages currently come from the host-local registry at
`127.0.0.1:4873`.

```bash
cd /home/dev/rusty-roleplay
./roleplay-frontend/node_modules/.bin/nx build roleplay-web --configuration production
./scripts/build-container-image.sh
./scripts/install-test-deployment.sh
./scripts/run-test-deployment.sh
```

The default LAN URL is `http://<host>:9350/`. Change
`RUSTY_ROLEPLAY_PORT` in the installed `.env` before starting if that port is
already occupied.

The account running these helpers must have effective access to
`/var/run/docker.sock`. Membership added to the `docker` group does not affect
an already-running login/session; restart that session before building if
`docker ps` still reports `permission denied`. If restarting an active session
would disrupt ongoing work, a host administrator can instead grant the current
agent UID access to the live socket:

```bash
sudo setfacl -m "u:$(id -u agent):rw" /run/docker.sock
docker version
```

Docker socket access is root-equivalent and this ACL is temporary: it is lost
when `docker.socket` recreates the socket. Remove it explicitly when it is no
longer needed:

```bash
sudo setfacl -x "u:$(id -u agent)" /run/docker.sock
```

Do not make the socket world-writable or expose an unauthenticated Docker TCP
listener as a workaround.

The installed deployment uses debug-role/no-auth mode so a browser elsewhere on
the trusted LAN can use every roleplay API without embedding an admin bearer
token in static JavaScript. A production deployment should use bearer auth or a
separate login/session design before being exposed beyond a trusted network.

## Seed and verification

`run-test-deployment.sh` waits for Compose health, then runs the installed seed
and smoke scripts inside the application container. The seed is idempotent and
creates:

- a no-secret den-router provider record and an RP narrator profile;
- a durable runtime session for that profile;
- one persona, character, roleplay session, and lore layer;
- one searchable canon lore entry.

The deterministic smoke checks liveness, SQLite diagnostics, the
profile/session read paths, an FTS5 lore write-read roundtrip, the bind-mounted
database file, and static SPA serving. The final live-turn smoke sends Rowan's
first message through the seeded RP narrator and host den-router, then requires
a completed streamed response.

### Browser live certification

After the installed stack is healthy, run the opt-in Playwright scenario
against the deployed frontend and API. It enters the seeded narrator directly, verifies
the configured RP scene and controls, sends a real narrator turn through
den-router, observes the phase lifecycle, expands tool and reasoning output,
and reloads the page to prove transcript persistence.

```bash
cd /home/dev/rusty-roleplay/roleplay-frontend
BASE_URL=http://<host>:9350 \
RUSTY_ROLEPLAY_DEPLOYED_RUN=1 \
RUSTY_ROLEPLAY_LIVE_RUN=1 \
RUSTY_ROLEPLAY_LIVE_BACKEND_URL=http://<host>:9350 \
pnpm exec playwright test \
  --config=apps/roleplay-web-e2e/playwright.config.mts \
  --project=chromium \
  --grep='@live-roleplay'
```

The scenario writes screenshots, the visible transcript, console and page
errors, a debug snapshot, and an evidence packet beneath Playwright's output
directory. A normal local E2E run skips this scenario unless
`RUSTY_ROLEPLAY_LIVE_RUN=1` is set.

## Mechanic approval-loop smoke

The seed also registers the distinct `roleplay-mechanic-test` profile as
`Maren`, applies the isolated `roleplay_mechanic` tool policy, and keeps one
active mechanic session attached to `roleplay-test-scene`. Run the opt-in
mechanic smoke inside this Compose project only:

```bash
cd /home/system/rusty-roleplay-test
docker compose exec -T rusty-roleplay \
  node /opt/rusty-roleplay/deployment-scripts/mechanic-live-smoke.mjs
```

The smoke drives a real mechanic wake through transcript, scene, and retrieval
inspection; requires model-created proposal and diagnostic records; proves the
proposal is inert before approval and apply; then covers applied idempotency,
rejection safety, and diagnostic outcome persistence. It intentionally changes
the disposable narrator exemplar. Re-running `seed-test-data.mjs` restores the
fixture exemplar before another certification run. Do not point this command at
shared live or debug Crew roots.

### Browser mechanic certification

Run the full browser-visible certification from the source checkout. The helper
seeds the isolated fixture, discovers its attached mechanic session, drives the
real mechanic chat and proposal controls in Chromium, restarts only the
`rusty-roleplay` service in this Compose project, and verifies the applied
proposal and diagnostic outcome after the service becomes healthy again.

```bash
cd /home/dev/rusty-roleplay
./scripts/run-mechanic-live-certification.sh
```

Each run writes screenshots, the visible mechanic transcript, console and page
errors, backend state receipts, an exact source/image revision snapshot, and an
evidence packet beneath
`/home/system/rusty-roleplay-test/artifacts/task-5962/<timestamp>/`. The
Playwright scenario is tagged `@live-mechanic` and remains skipped during normal
E2E runs. Its restart gate must not be enabled for any shared Crew deployment.

## Backup and reset

For a consistent SQLite backup, stop the service before copying its data:

```bash
cd /home/system/rusty-roleplay-test
docker compose stop rusty-roleplay
cp -a data/engine "backups/engine-$(date +%Y%m%dT%H%M%S)"
docker compose start rusty-roleplay
```

To reset only this disposable deployment, stop it and remove files under its
`data`, `config/profiles`, and `config/service.json` paths, then reinstall and
rerun the seed. Never point this Compose file at the shared live or debug Crew
roots.
