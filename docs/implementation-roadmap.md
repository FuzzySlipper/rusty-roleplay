# Implementation Roadmap

**Status:** Living plan document
**Last updated:** 2026-06-26

## Guiding principle

**Fastest path to "I can stop running the ST server."** Each phase prioritizes what gets a usable, lore-aware RP session in the users' hands. Quality features and polish are deferred until the core loop works end-to-end.

## Architecture decisions (resolved)

These were worked out across the crew-agent storage strategy doc, the lore layers design, and discussions.

**Q: Rust layer vs brain-island TS for lore storage?**
**A: Rust layer.** Schema migrations, repository interfaces, and transaction boundaries are Rust-owned (matching the existing profile memory pattern). The TS brain island gets tool definitions that call the native bridge — same pattern as `listProfileMemory` / `addProfileMemory`, just with lore-specific operations.

**Q: Single lore set or layered lore?**
**A: Layered.** Replacing the Go `campaign` model with flexible lore layers. Each layer is a named collection of entries with a write policy (`manual`, `auto_capture`, or `readonly`). Chats enable multiple layers with toggle + priority. Entries can be promoted between layers. See [lore-layers-design.md](./lore-layers-design.md).

**Q: Shared SQLite or separate lore DB?**
**A: Shared Crew DB.** Lore follows the module-owned data pattern: modules declare a schema bundle, the service owns migration and namespace enforcement.

**Q: Keep or delete lorekeep Go code?**
**A: Keep as reference until Rust lore module is complete and tested, then remove.** The Go implementation is the reference for scoring logic, FTS5 queries, and contract shapes — even though the data model is changing to layers.

**Q: PostgreSQL vs SQLite?**
**A: SQLite near-term, abstracted for future Postgres.** Lore storage is read-dominant and fits SQLite well. The storage layer abstracts behind Rust persistence APIs so a backend swap is feasible later.

## Phase 1: Lore module in rusty-crew Rust persistence

Build the lore storage layer in rusty-crew's Rust persistence crates, following lore-layers-design.md. This is a **new implementation** (not a port of the Go model), though the Go code serves as reference for scoring, FTS5, and recall mechanics.

**Task 1.1: Schema and migration**
- Tables: `layer`, `lore_entry`, `chat_layer`, `layer_config`, `topic_node`, `topic_edge`, `retrieval_trace`
- FTS5 virtual table on lore_entry (title, summary, body, tags)
- Indexes on layer_id, chat_id, slug, canon_level, created_at
- Layer-level foreign key constraints (write policy enforcement in Rust, not SQL)

**Task 1.2: Layer repository**
- CRUD: create, get by id, get by profile, update metadata, archive, delete
- Layer listing (by profile, by purpose, by write_policy)
- Chat-layer association: add/enable/disable/remove/reorder

**Task 1.3: Entry repository**
- CRUD: create, get by slug, get by layer, update (with version increment), delete (soft: set canon_level=retired)
- Search: FTS5 across layer set (scoped to active chat layers)
- Constant entries query (by layer, by priority order, with max_constants limit)
- Supersession chain: get_entry + follow superseded_by

**Task 1.4: Recall and scoring service**
- RecallCandidates: FTS5 query across active layers, with profile scope and campaign/subject context
- Score function (from Go model, adapted for layers):
  - FTS relevance (from FTS5 rank)
  - Subject match boost (active_subjects)
  - Subject exclusion penalty (excluded_subjects)
  - Canon level weight (established > speculative > superseded/retired)
  - Layer-origin boost (configurable per layer, not just campaign)
  - Tag boost from query tags
  - Recency decay (for auto-captured entries)
- Token-budgeted packet assembly:
  1. Collect constants from each active layer (by layer priority order, up to per-layer max_constants)
  2. Constants consume from per-layer constant_token_reserve
  3. Scored entries consume from remaining shared budget
  4. Skip entries below min_relevance_score even if budget remains
- Retrieval trace construction (entries considered, per-entry scores, config snapshot, budget decisions)

**Task 1.5: Fact capture and promotion**
- `capture_fact`: creates entry in the chat's auto_capture layer
  - Auto-generates slug from title (slugify + dedup)
  - Sets provenance to chat id + timestamp
  - Records capture_reason
  - Verifies target layer's write_policy allows auto_capture
- `promote_entry`: copies entry from source layer to target layer
  - Copies body, tags, subject_refs
  - Sets provenance to "promoted from {source_layer.name}"
  - Source entry remains (not moved)
  - Target layer must not be readonly

**Task 1.6: Retrieval config (per-layer)**
- CRUD for layer_config
- Default weights from lorekeep/scoring defaults
- Config stored in SQLite (not JSON), mutable through tools and UI

**Task 1.7: Topic graph (optional in v0.1)**
- Node CRUD (name, slug, description, tags)
- Edge CRUD (source → target, edge type, weight)
- Neighbor traversal (depth-limit gated)
- Can be deferred — entries with tags and subject_refs provide enough structure for initial recall

**Task 1.8: Native bridge surface (Rust → TS)**
- Operations per existing profile-memory bridge pattern:
  - `searchLore`, `recallLore`, `captureFact`, `promoteEntry`
  - `listLayers`, `getLayer`, `createLayer`, `archiveLayer`
  - `getEntry`, `updateEntry`
  - `getLayerConfig`, `putLayerConfig`
  - `getTrace`, `listTraces`
  - `getActiveLayers`, `toggleLayer`, `reorderLayers`

**Task 1.9: Tool definitions (TS brain island)**
- `search_lore(query, layer_ids?, tags?)` — FTS5 search scoped to specified layers (or all active)
- `recall_lore(query, active_subjects?, excluded_subjects?)` — scored recall across active layers
- `capture_fact(title, body, tags?, subject_refs?, reason?)` — record established fact
- `promote_entry(entry_slug, target_layer_id)` — promote to permanent layer
- `explore_topic(node_slug, depth?)` — topic graph traversal
- `list_layers(purpose?, write_policy?)` — browse available layers
- `get_layer_config(layer_id)` — read retrieval config

**Validation gate:** Seed test lore across two layers (world + story). Run recall queries. Verify layer-scoped scoring, budget sharing, constant priority, and write-policy enforcement all work correctly.

## Phase 2: Narrator agent profile

**Task 2.1: Basic narrator profile (TS brain island)**
- System prompt: register establishment + creative permission (from `docs/02-narrator-agent-and-loop.md`)
- Tool configuration: lore tools + scene state tools
- Style exemplar input (reference turns as a profile config field)
- Profile configuration: tone, explicitness, pacing, memory depth, model override

**Task 2.2: Two-phase generation**
- Phase 1 (explore): agent searches lore, captures facts, assembles scene brief
- Phase 2 (compose): clean generation with scene brief + chat history
- Phase transition events through session event stream
- Optional review sub-phase

**Task 2.3: Tool-call excision from session history**
- Strip tool calls from persistent conversation history after turn commits
- Tool calls logged to retrieval traces
- Persistent history is pure user/assistant message pairs

**Task 2.4: Scene state tools**
- `get_scene_state(session_id)` — current scene
- `update_scene_state(scene_data)` — update scene state

**Validation gate (THE QUALITY SPIKE):** Does an agent with lore tools produce better RP responses than ST's keyword injection? Test with migrated lore. If not clearly better, pause and fix.

## Phase 3: Frontend wiring (real backends, not demos)

**Task 3.1: Transport wiring**
- Replace demo data with rusty-view SSE transport connected to rusty-crew
- Wire send → session submit, streaming → transcript renderer
- Phase state machine (idle → exploring → composing → done)

**Task 3.2: LoreSource HTTP client → rusty-crew lore bridge**
- Replace `MockLoreSource` with real lore module calls
- Lorebook panel shows real entries, layer controls (toggle layers, promote entries)

**Task 3.3: Layer management UI**
- Layer list (name, description, write policy badge, entry count)
- Layer creation dialog (name, description, purpose, write policy)
- Layer toggle per chat (chat settings panel)
- Layer priority reorder (drag handles)

**Task 3.4: Entry management UI**
- Entry list per layer (search, filter by tags/canon_level)
- Entry editor (title, body, tags, subject_refs, canon_level)
- Promote button with target layer picker
- Entry details view (provenance, trace references)

**Task 3.5: Character management**
- Character CRUD UI
- Character list with search, filter, sorting
- Character → session relationship
- Alternate greetings management

**Task 3.6: Session management**
- New session, continue, archive
- Session list, metadata (character, active layers)

**Milestone: first usable RP session.** Users can open the browser, pick character + layers, write a message, and get a lore-aware response.

## Phase 4: SillyTavern migration

**Task 4.1: Lore book migration**
- Parse ST world-info JSON → layer entries
- Create one `readonly` layer per imported book (preserves ST organization)
- Or flatten into a `mixed` layer if that's what the user prefers

**Task 4.2: Character card migration**
- Parse PNG/JSON → character entries + initial lore layer for character details

**Task 4.3: Chat history import (optional)**
- Import JSONL as archived conversations

**Milestone: ST server shutdown eligible.**

## Phase 5: Mechanic / OOC agent

**Task 5.1: Mechanic profile (TS brain island)**
- System prompt: diagnostician
- Read tools: `get_rp_history`, `get_last_scene_brief`, `get_recall_logs`, etc.
- Write tools through proposal system

**Task 5.2: OOC mode UI**
- Mode switch: RP ↔ mechanic
- Proposal review panel

**Validation gate:** User can diagnose a quality issue and apply a fix through the mechanic.

## Phase 6: Quality features

- Self-review pass (gravity drift, voice drift, continuity)
- Context compaction (tool-call excision, scene-aware compaction)
- Tuning: review frequency, lore retrieval, style exemplars

## Phase 7: Deployment & polish

- Docker deployment (one rusty-crew container + frontend static files)
- Lorekeep Go decommissioning
- Profile management UI (sibling profiles)
- ST parity gap list

## Phase ordering rationale

| Phase | Why here |
|-------|----------|
| 1 (lore module) | New layers data model, primary differentiator |
| 2 (narrator agent) | Quality spike — proves the architecture |
| 3 (frontend wiring) | Users can interact |
| 4 (ST migration) | Users bring real content |
| 5 (mechanic agent) | Power user feature |
| 6 (quality) | Polish on working system |
| 7 (deployment) | When convenient |
