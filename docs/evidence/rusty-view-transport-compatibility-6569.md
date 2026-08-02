# Rusty View transport compatibility evidence — task #6569

This record certifies the isolated Roleplay deployment against the exact Rusty
View consumer packages used by the transcript architecture campaign. The
deployment keeps its existing SQLite state and uses Crew's explicit debug
coordination route; production coordination remains intentionally unavailable
on this debug service.

## Provenance and preserved state

- Rusty View consumer source: `9720a5e94f81057d3fbd39638e457317526a281b`
- Rusty View package version: `0.0.6555` across all nine public packages
- Roleplay image source: `6275f0b3ee96a8896768f8dd021f6ddc8717d0a5`
- Crew image source: `2d655cbf1525d5517c99f6e39d10064fb69abdb7`
- isolated deployment: `http://127.0.0.1:9350`
- pre-upgrade SQLite backup:
  `/home/system/rusty-roleplay-test/backups/engine-20260802T141723Z`

The current Crew configuration schema no longer accepts the retired
`wakeTimeout` field. Both checked-in isolated service configurations remove it;
the wake lifecycle remains owned by current Crew defaults instead of a stale
compatibility setting. The preserved `roleplay-test` profile and
`roleplay-test-scene` session remained readable after migration, and the
deterministic container smoke confirmed the non-empty SQLite store plus lore
FTS lookup.

## Transport checks

| Check                           | Result                                         |
| ------------------------------- | ---------------------------------------------- |
| `/v1/debug/coordination/agents` | 200 with `deploymentRole: debug`               |
| `/v1/coordination/agents`       | 409 as expected for the wrong deployment role  |
| `roleplay-test` profile         | 200 after upgrade                              |
| `roleplay-test-scene` session   | 200 with preserved transcript/state            |
| logical-turn read endpoint      | 200; previously absent from the old image      |
| installed runtime config        | same-origin API with `coordinationRole: debug` |

The image upgrade first exposed a real Crew integration defect: Roleplay's
explore, compose, review, and final compose requests share one logical-turn
continuation. Crew previously reused one provider-operation ID for every phase,
so the second distinct request correctly tripped the durable content-collision
guard. Upstream Crew task #6571 assigns a monotonic request sequence to later
provider operations while retaining the legacy first ID and the existing
different-content collision check.

The successful live turn
`turn:3f34042eb0350870192fe2704f7e888ef4d2cd8ed846e5d7917810b88c599131`
persisted four distinct completed provider receipts: the legacy base operation
and `:request:1`, `:request:2`, and `:request:3`.

## Exact consumer live proof

The opt-in Chromium scenario ran from an archive checkout containing the exact
`0.0.6555` packages, not the Roleplay repository's normal dependency set:

```text
BASE_URL=http://127.0.0.1:4205 \
RUSTY_ROLEPLAY_DEPLOYED_RUN=1 \
RUSTY_ROLEPLAY_LIVE_RUN=1 \
RUSTY_ROLEPLAY_LIVE_BACKEND_URL=http://127.0.0.1:9350 \
pnpm exec playwright test \
  --config=apps/roleplay-web-e2e/playwright.config.mts \
  --project=chromium --grep='@live-roleplay'
```

Result: 1/1 passed in 1.8 minutes. The phase history was
`Done -> Searching lore... -> Writing... -> Reviewing... -> Writing... -> Idle`.
The transcript rendered five lore/state tool calls, the narrator completion,
roleplay controls, and the same completion after reload. Console errors and
page errors were both zero.

The retained artifact root is:

```text
/tmp/rusty-roleplay-6555-1785677973/roleplay-frontend/dist/.playwright/
apps/roleplay-web-e2e/test-output/deployed-roleplay.live-dep-5c05f-h-RP-controls-live-roleplay-chromium/live-artifacts
```

This is an isolated certification artifact, not a portable repository input;
the durable facts and exact identities are recorded here so the proof remains
auditable after temporary test workspaces are removed.
