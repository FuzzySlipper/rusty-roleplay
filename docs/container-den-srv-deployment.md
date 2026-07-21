# Isolated den-srv deployment

The `rusty-eva-roleplay` deployment is a separate Rusty Crew process serving
the Rusty Roleplay frontend. Its runtime files live at
`/data/docker/rusty-eva-roleplay` on `den-srv`; it does not share configuration,
SQLite data, profiles, sessions, artifacts, or workspaces with `rusty-eva`, the
disposable `/home/system/rusty-roleplay-test` stack, or any other Crew service.

Deploy or update it from the source checkout:

```bash
cd /home/dev/rusty-roleplay
./scripts/deploy-den-srv.sh
```

The script builds the production frontend, packages the exact clean
`/home/dev/rusty-crew` revision into a runtime image, transfers missing images
to the rootless Docker daemon on `den-srv`, selects the first unused host port
in `9347-9399`, installs the deployment, and verifies the health endpoint,
static application shell, and isolated SQLite database. Later runs preserve the
selected port and mutable state while backing up the previous site and Compose
metadata.

Useful overrides include:

- `RUSTY_EVA_ROLEPLAY_REMOTE_PORT` to request a specific unused port.
- `RUSTY_EVA_ROLEPLAY_REMOTE_PORT_START` and `_PORT_END` to change the scan range.
- `RUSTY_EVA_ROLEPLAY_REMOTE_PUBLIC_HOST` to change the reported browser host.

The initial configuration intentionally contains no profiles, brains, or
sessions. It uses its own SQLite database at
`/data/docker/rusty-eva-roleplay/data/engine/coordination.sqlite3`.

The Crew admin API currently runs without bearer authentication so the static
frontend can use same-origin requests. Before exposing the Caddy hostname beyond
a trusted network, add an authentication layer in Caddy or arrange an equivalent
access-control boundary.
