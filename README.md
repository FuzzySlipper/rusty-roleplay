# Rusty Roleplay

Rusty Roleplay is the roleplay-specific web client and migration tooling for
[Rusty Crew](../rusty-crew). It consumes versioned Rusty View packages for
generic chat, transport, transcript, and service-debug behavior, then adds
roleplay sessions, characters, personas, lore, narrator configuration,
branching, mechanics, and SillyTavern import workflows.

## Repository layout

```text
roleplay-frontend/        Angular/Nx application and roleplay libraries
tools/st-migration/       SillyTavern migration utilities
lorekeep/                 legacy Go lore service retained during migration
docker/                   container build and installed-deployment templates
scripts/                  image build and deployment helpers
docs/                     architecture and operational documentation
```

Rusty Crew owns runtime authority, persistence, HTTP/SSE APIs, profiles, model
providers, and roleplay domain operations. Rusty View stays roleplay-agnostic.
This repository owns only the roleplay-specific presentation and workflows.

## Frontend development

The frontend requires Node 20+ and pnpm 11+.

```bash
cd roleplay-frontend
pnpm install --frozen-lockfile
pnpm exec nx serve roleplay-web
```

Useful checks:

```bash
pnpm exec nx build roleplay-web --configuration production
pnpm exec nx lint roleplay-web
pnpm exec nx test roleplay-web
```

The production build is written to
`roleplay-frontend/dist/apps/roleplay-web/browser`.

## Isolated container deployment

The task-3439 test deployment keeps all runtime state and fixtures out of the
shared Crew services. Source build assets remain in this repository, while the
installed Compose deployment lives at `/home/system/rusty-roleplay-test` and
uses host bind mounts rather than named volumes.

See [container test deployment](docs/container-test-deployment.md) for the
layout, build/install commands, seeded roleplay fixture, LAN URL, health checks,
backup procedure, and current Docker-socket prerequisite.

## Backend contract

Do not hand-write generic chat protocol shapes here or fork Rusty View. Rusty
Crew's public API artifacts and Rusty View's versioned packages are the contract
boundary. Roleplay-only APIs and UI remain in this repository.
