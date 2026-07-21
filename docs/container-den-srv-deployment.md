# Isolated den-srv deployments

Each Roleplay deployment is a separate Rusty Crew process serving the Rusty
Roleplay frontend. `rusty-eva-roleplay` and `rusty-lore-roleplay` live under
matching direct children of `/data/docker` on `den-srv`; they do not share
configuration, SQLite data, profiles, sessions, artifacts, or workspaces with
each other, `rusty-eva`, the disposable `/home/system/rusty-roleplay-test`
stack, or any other Crew service.

Deploy or update it from the source checkout:

```bash
cd /home/dev/rusty-roleplay
./scripts/deploy-den-srv.sh

# Deploy or update the second isolated Roleplay instance.
./scripts/deploy-den-srv.sh rusty-lore-roleplay
```

The script builds the production frontend, packages the exact clean
`/home/dev/rusty-crew` revision into a runtime image, transfers missing images
to the rootless Docker daemon on `den-srv`, selects the first unused host port
in `9347-9399`, installs the deployment, and verifies the health endpoint,
static application shell, and isolated SQLite database. Later runs preserve the
selected port and mutable state while backing up the previous site and Compose
metadata.

The no-argument form remains an alias for `rusty-eva-roleplay`. Useful generic
overrides include:

- `RUSTY_ROLEPLAY_REMOTE_PORT` to request a specific unused port.
- `RUSTY_ROLEPLAY_REMOTE_PORT_START` and `_PORT_END` to change the scan range.
- `RUSTY_ROLEPLAY_REMOTE_PUBLIC_HOST` to change the reported browser host.

The earlier `RUSTY_EVA_ROLEPLAY_*` override names remain accepted for backward
compatibility.

An initial configuration contains no profiles, brains, or sessions until the
first-narrator setup flow is completed. Each instance uses its own SQLite
database under `<deployment-root>/data/engine/coordination.sqlite3`.

## Update every managed instance

Run the orchestrator after a committed Rusty Crew, Rusty View, or Rusty
Roleplay update:

```bash
cd /home/dev/rusty-roleplay
./scripts/update-den-srv-instances.sh
```

It validates that the relevant local checkouts are clean, prints their exact
revisions, then updates these deployments in order:

1. `/data/docker/rusty-eva` from `/home/dev/rusty-view`
2. `/data/docker/rusty-eva-roleplay` from this checkout
3. `/data/docker/rusty-lore-roleplay` from this checkout

Use `--dry-run` to print the operations without changing deployments, or
`--only <instance>` to update just one of `rusty-eva`,
`rusty-eva-roleplay`, or `rusty-lore-roleplay`. The deployment installers keep
each existing port and mutable data directory while replacing the frontend,
runtime image, and Compose metadata.

The Crew admin API currently runs without bearer authentication so the static
frontend can use same-origin requests. Before exposing the Caddy hostname beyond
a trusted network, add an authentication layer in Caddy or arrange an equivalent
access-control boundary.
