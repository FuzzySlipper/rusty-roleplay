# lorekeep v0 contract artifacts

Task: rusty-roleplay #3209
Contract version: `v0`

This document describes lorekeep's v0 contract: the stable vocabulary, scoring
defaults, JSON schemas, and example payloads that define the lorekeep HTTP API.
The contract is locked before the service implementation so downstream
consumers — the lorekeep service, the rusty-crew RP harness, the frontend HTTP
client, and the SillyTavern migration script — can build against a fixed
interface. Implementation may evolve behind the contract.

It follows den-memory's contract-first pattern (`den-memory/contracts/v0/`)
with RP-native vocabulary. lorekeep is a separate service, not a fork of
den-memory.

## Artifact map

```
lorekeep/
  contracts/v0/
    registry.json              — canonical enum/registry values (closed vocabulary)
    scoring-defaults.json      — named scoring profiles with per-factor weights
    tools.json                 — lorekeep agent tool surface (narrator + mechanic)
    schemas/
      entry.schema.json            — authored lore entry / established fact
      recall-request.schema.json   — recall query
      recall-packet.schema.json    — recall response
      retrieval-trace.schema.json  — per-retrieval diagnostic trace
      retrieval-config.schema.json — per-campaign retrieval config
      fact-capture.schema.json     — capturing an established fact during play
      fact-promotion.schema.json   — promoting a fact toward canon
      topic-node.schema.json       — graph node for world structure
      topic-edge.schema.json       — typed edge between nodes
      campaign.schema.json         — campaign (lore isolation boundary)
      health.schema.json           — GET /health response
      version.schema.json          — GET /version response
    examples/
      entry.example.json
      recall-request.example.json
      recall-packet.example.json
      retrieval-trace.example.json
      retrieval-config.example.json
      fact-capture.example.json
      fact-promotion.example.json
      topic-graph.example.json     — nodes + edges for a small world
      campaign.example.json
      health.example.json
      version.example.json
  cmd/lorekeep-validate/main.go    — stable validation command
```

Layout follows `docs/05-project-layout.md`: examples live under
`contracts/v0/examples/`, not a top-level `examples/` tree.

## Canonical vocabulary

`contracts/v0/registry.json` is a **closed registry**: unknown values are
rejected. Adding a value requires a deliberate registry migration, never silent
API acceptance. The schemas inline the same enum values so malformed payloads
are rejected at validation time.

| Registry key | Values |
|---|---|
| `entry_kinds` | `authored_lore`, `established_fact` |
| `subject_kinds` | `world_rule`, `character`, `location`, `faction`, `item`, `event`, `relationship` |
| `node_kinds` | `character`, `location`, `faction`, `item`, `event`, `concept` |
| `canon_levels` | `canon`, `session_canon`, `rumor`, `deprecated`, `ambiguous` |
| `campaign_scopes` | `campaign`, `character`, `location`, `faction`, `explicit_only` |
| `entry_statuses` | `active`, `superseded`, `deprecated`, `archived` |
| `content_formats` | `markdown` |
| `captured_by_actors` | `rp_agent`, `mechanic_agent`, `user` |
| `fact_capture_reasons` | `plot_event`, `relationship_change`, `revealed_information`, `character_development`, `user_override` |
| `retrieval_strategies` | `narrative_default`, `lore_heavy`, `character_focused` |
| `retrieval_depths` | `shallow`, `standard`, `deep` |
| `retrieval_outcomes` | `included`, `below_threshold`, `excluded_subject`, `canon_filtered`, `scope_filtered`, `over_budget` |
| `edge_relations` | `member_of`, `located_in`, `rival_of`, `owns`, `knows_about`, `controls`, `parent_of`, `related_to` |

The `campaign_scopes` vocabulary is the entry/node `discovery_scope` enum.
`retrieval_outcomes` is the trace/skip `reason` enum.

## Scoring defaults

`contracts/v0/scoring-defaults.json` holds three named scoring profiles, each
supplying per-factor weights for the scoring model in
`docs/01-lore-service-design.md`:

```
base = (
  fts_score            * w.fts_score +
  tag_match            * w.tag_match +
  subject_match        * w.subject_match +
  canon_level_modifier * w.canon_level_modifier +
  recency_modifier     * w.recency_modifier +
  scope_match          * w.scope_match +
  tag_boost            * w.tag_boost
)
score = excluded ? base * w.excluded_subject_penalty : base
```

- `narrative-default` — balanced weighting for general RP (the default profile).
- `lore-heavy` — favors comprehensive lore retrieval (higher `fts_score`).
- `character-focused` — favors character-specific entries (higher `subject_match`).

`excluded_subject_penalty` is a `[0,1]` multiplier; `0.0` zeroes out entries
about subjects explicitly excluded from the scene (bleed prevention). The file
also carries shared `canon_level_scores` and `entry_status_scores` reference
tables.

**Scoring model choice.** The file's `model` field declares
`weighted_sum_then_penalty` and its `formula` field spells the computation out.
This deliberately differs from den-memory's additive-modifier model (fixed
authority/curation modifiers summed together). lorekeep tunes *per-factor
emphasis by named profile* — the natural shape for RP recall, where "favor
character detail" vs "favor broad lore" is a weighting decision, not a new set
of authority modifiers. The design doc (`docs/01-lore-service-design.md`)
specifies this model and the task enumerates the per-factor weights, so v0
locks the weighted-sum model rather than adopting den-memory's structure.

These are v0 implementation constants, **not tuned truth** — they get
calibrated after dogfooding.

## Schema coverage

Every schema sets `additionalProperties: false` and inlines closed enums.
Slugs are constrained to `^[a-z0-9]+(-[a-z0-9]+)*$`. Together the schemas cover:

- **Storage**: `entry` (authored lore + established facts, with provenance and
  lifecycle fields), `topic-node`, `topic-edge`.
- **Recall**: `recall-request` (query + active/excluded subjects +
  `config_overrides`), `recall-packet` (scored entries, skipped reasons, budget,
  trace reference).
- **Control & observation**: `retrieval-config` (per-campaign knobs),
  `retrieval-trace` (entries considered, scene brief, config snapshot).
- **Capture & promotion**: `fact-capture` (capturing a diegetic fact during
  play), `fact-promotion` (raising a fact toward canon).
- **Reference & ops**: `campaign` (the lore isolation boundary), `health` and
  `version` (deployable-service response shapes).

The `entry` schema documents `constant` semantics: a constant entry bypasses
the `min_score` threshold and subject filtering and is always injected into the
scene brief (subject to the token budget) — it is *not scored for ranking*,
distinct from "given max score." This keeps world-rule entries deterministic.

### Fact promotion

`fact-promotion.schema.json` is a **dedicated request shape** for
`POST /api/facts/{slug}/promote`, rather than folding promotion into a generic
entry `PATCH`. Promotion carries its own authority semantics (`promoted_by`,
`note`) and is constrained to strengthening canon transitions, which a generic
field update could not enforce as cleanly.

## Tool surface

`contracts/v0/tools.json` defines the **lorekeep-backed** agent tools so the
rusty-crew `adapter-lorekeep` package generates rather than hand-writes them
(no hand-written protocol copies). Two tool sets:

- **narrator**: `search_lore`, `recall_lore`, `explore_topic`, `capture_fact`.
- **mechanic**: `search_lore`, `get_recall_logs`, `get_retrieval_config`,
  `get_established_facts`, and the lore-domain proposal tools
  (`propose_lore_add`, `propose_lore_edit`, `propose_lore_tag_update`,
  `propose_retrieval_config_change`).

Each tool names its backing endpoint and declares a JSON-Schema parameter
object. Session/coordination tools the agents also use (`get_scene_state`,
`get_rp_history`, `get_last_scene_brief`, profile/system-prompt reads,
`apply_proposal`, and non-lore `propose_*`) are backed by rusty-crew session
state, **not** lorekeep, so they are intentionally out of scope here — lorekeep
knows nothing about rusty-crew internals. The adapter composes those separately.

## Validation

```bash
cd lorekeep
go run ./cmd/lorekeep-validate
```

The command:

1. Loads `registry.json`, checks required keys are present, non-empty, and
   duplicate-free, and spot-checks canonical values.
2. Loads `scoring-defaults.json`, verifies the default profile exists, every
   profile defines all eight factor weights, `excluded_subject_penalty` stays in
   `[0,1]`, the profile-intent ordering holds (`character-focused` weights
   `subject_match` above the default; `lore-heavy` weights `fts_score` at least
   as high), and `canon > rumor > deprecated`.
3. Loads `tools.json` and checks it is internally consistent: every tool named
   in a tool set is defined, names are unique, and each tool carries a behavior
   and a parameters object.
4. Compiles all schemas and validates each example payload against its schema.
   `topic-graph.example.json` is validated node-by-node and edge-by-edge.
5. Runs negative cases proving the closed registry rejects an unknown
   `canon_level` and a payload missing a required field.

Exit code `0` on success, `1` on the first failure.
