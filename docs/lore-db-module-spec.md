# Lore DB Module Specification

**For:** rusty-crew lore implementation (crew agent)
**Status:** Draft spec
**Date:** 2026-06-26
**Supersedes:** The old layers design — this spec is the implementation target.

## 1. What already exists (don't rebuild)

rusty-crew `core-persistence` already has the following landed in schema migration v24. These are the foundation — this spec builds on top of them, not replacing them.

### 1.1 Tables (migration v24)

- `module_roleplay_lore_records` — generic lore records with `world_id`, `entity_id`, `shape_id`, `canon_status`, `visibility`, `status`, `revision`, `title`, `body`, `content_json`, `evidence_refs_json`, `source`, `confidence`, `supersedes_record_id`, `superseded_by_record_id`, `tombstoned_at`, `tombstone_reason`
- `module_roleplay_lore_provenance_events` — provenance audit trail

### 1.2 CoordinationStore methods

- `add_roleplay_lore_record` — insert with provenance event, record_id uniqueness check
- `replace_roleplay_lore_record` — optimistic concurrency via `expected_revision`
- `supersede_roleplay_lore_record` — bulk insert+mark with world_id consistency check
- `tombstone_roleplay_lore_record` — soft delete with revision guard
- `query_roleplay_lore_records` — query with world/entity/status/canon filters
- `roleplay_lore_provenance_events` — event listing by record_id or world_id

### 1.3 Memory space descriptor

A complete `MemorySpaceDescriptor` for `roleplay_lore` with:
- Shapes: `world`, `entity`, `lore_entry`, `relationship`, `timeline_event`, `provenance_event`
- Scope model: World (primary), Entity, Session, ConversationBranch
- Write policy: ManualReview default, with per-operation governance
- Retrieval: DirectLookup, QuerySearch, Relevance, DomainSpecific
- Provenance: evidence required, source required, rationale required
- Conflict: ExpectedRevision

### 1.4 Query API

`query_roleplay_lore_records` already supports filtering by: `world_id`, `entity_id`, `session_id`, `shape_id`, `canon_status`, `visibility`, `status`, text search via `content_json`. This is sufficient for both UI listing and agent queries.

## 2. What needs to be added

### 2.1 New table: lore_layer

The `world_id` field in the existing tables maps to a *single* scope. The layers model needs layers as first-class objects that can be created, named, and per-chat toggled.

```sql
-- New migration v25
CREATE TABLE IF NOT EXISTS module_roleplay_lore_layers (
    layer_id        TEXT PRIMARY KEY,
    profile_id      TEXT NOT NULL,          -- user profile owner
    name            TEXT NOT NULL,           -- "World Details", "Current Story"
    description     TEXT,                    -- what this layer is for
    purpose         TEXT NOT NULL DEFAULT 'mixed',  -- world | story | characters | factions | mixed
    write_policy    TEXT NOT NULL DEFAULT 'manual',  -- manual | auto_capture | readonly
    is_archived     INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_roleplay_lore_layers_profile
    ON module_roleplay_lore_layers(profile_id, is_archived, name);
```

### 2.2 New table: lore_layer_entry

Links entries to layers. Since existing lore records use `world_id` as scope, and a layer IS the new world-like scope, we make this a connection table.

```sql
CREATE TABLE IF NOT EXISTS module_roleplay_lore_layer_entries (
    layer_id    TEXT NOT NULL,
    record_id   TEXT NOT NULL,
    is_constant INTEGER NOT NULL DEFAULT 0,  -- always-inject entry
    priority    INTEGER NOT NULL DEFAULT 0,  -- lower = shown first
    added_at    TEXT NOT NULL,
    PRIMARY KEY (layer_id, record_id),
    FOREIGN KEY (layer_id) REFERENCES module_roleplay_lore_layers(layer_id),
    FOREIGN KEY (record_id) REFERENCES module_roleplay_lore_records(record_id)
);
CREATE INDEX IF NOT EXISTS idx_roleplay_lore_layer_entries_record
    ON lore_layer_entries(record_id, layer_id);
```

### 2.3 New table: chat_layer

Per-chat toggle of layers with priority ordering.

```sql
CREATE TABLE IF NOT EXISTS module_roleplay_chat_layers (
    chat_id     TEXT NOT NULL,
    layer_id    TEXT NOT NULL,
    priority    INTEGER NOT NULL DEFAULT 0,  -- lower = fetched first
    enabled     INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL,
    PRIMARY KEY (chat_id, layer_id),
    FOREIGN KEY (layer_id) REFERENCES module_roleplay_lore_layers(layer_id)
);
```

### 2.4 New table: lore_recall_trace

Records what was retrieved and why. Uses existing `module_roleplay_lore_provenance_events` for entry-level provenance, but adds run-level recall diagnostics.

```sql
CREATE TABLE IF NOT EXISTS module_roleplay_lore_recall_traces (
    trace_id        TEXT PRIMARY KEY,
    session_id      TEXT,                    -- which RP session
    layer_ids       TEXT NOT NULL,           -- JSON array: layers queried
    query_text      TEXT,                    -- the recall query
    active_subjects TEXT,                    -- JSON array
    excluded_subjects TEXT,                  -- JSON array
    config_snapshot TEXT NOT NULL,           -- JSON: the active config at recall time
    entries_considered INTEGER NOT NULL,
    entries_returned  INTEGER NOT NULL,
    token_budget      INTEGER NOT NULL,
    tokens_consumed   INTEGER NOT NULL,
    created_at      TEXT NOT NULL
);
```

### 2.5 New table: lore_layer_config

Per-layer retrieval configuration. A new table rather than a JSON blob in the layer row, matching the existing pattern of structured config with typed fields.

```sql
CREATE TABLE IF NOT EXISTS module_roleplay_lore_layer_config (
    config_id               TEXT PRIMARY KEY,
    layer_id                TEXT NOT NULL UNIQUE,
    fts_weight              REAL NOT NULL DEFAULT 1.0,
    subject_weight          REAL NOT NULL DEFAULT 1.0,
    canon_weight            REAL NOT NULL DEFAULT 0.5,
    tag_boost_weight        REAL NOT NULL DEFAULT 0.5,
    recency_weight          REAL NOT NULL DEFAULT 0.2,
    default_token_budget    INTEGER NOT NULL DEFAULT 4000,
    constant_token_reserve  INTEGER NOT NULL DEFAULT 500,
    min_relevance_score     REAL NOT NULL DEFAULT 0.3,
    max_constants           INTEGER NOT NULL DEFAULT 5,
    created_at              TEXT NOT NULL,
    updated_at              TEXT NOT NULL,
    FOREIGN KEY (layer_id) REFERENCES module_roleplay_lore_layers(layer_id)
);
```

### 2.6 FTS5 virtual table

Existing records have `title`, `body`, and `content_json` fields. Add an FTS5 table for full-text search across lore body content.

```sql
CREATE VIRTUAL TABLE IF NOT EXISTS module_roleplay_lore_records_fts USING fts5(
    record_id UNINDEXED,
    title,
    body,
    tags TEXT DEFAULT '',
    content='module_roleplay_lore_records',
    content_rowid='rowid'
);

-- Triggers to keep FTS5 in sync with the main table
CREATE TRIGGER IF NOT EXISTS module_roleplay_lore_records_ai AFTER INSERT ON module_roleplay_lore_records BEGIN
    INSERT INTO module_roleplay_lore_records_fts(record_id, title, body, tags)
    VALUES (new.record_id, new.title, new.body, new.content_json);
END;

CREATE TRIGGER IF NOT EXISTS module_roleplay_lore_records_ad AFTER DELETE ON module_roleplay_lore_records BEGIN
    INSERT INTO module_roleplay_lore_records_fts(module_roleplay_lore_records_fts, record_id, title, body, tags)
    VALUES ('delete', old.record_id, old.title, old.body, old.content_json);
END;

CREATE TRIGGER IF NOT EXISTS module_roleplay_lore_records_au AFTER UPDATE ON module_roleplay_lore_records BEGIN
    INSERT INTO module_roleplay_lore_records_fts(module_roleplay_lore_records_fts, record_id, title, body, tags)
    VALUES ('delete', old.record_id, old.title, old.body, old.content_json);
    INSERT INTO module_roleplay_lore_records_fts(record_id, title, body, tags)
    VALUES (new.record_id, new.title, new.body, new.content_json);
END;
```

## 3. New CoordinationStore methods

### 3.1 Layer CRUD

```rust
pub fn create_lore_layer(&self, write: &LoreLayerWrite) -> CoreResult<LoreLayerRecord>
pub fn get_lore_layer(&self, layer_id: &str) -> CoreResult<Option<LoreLayerRecord>>
pub fn list_lore_layers_by_profile(&self, profile_id: &str) -> CoreResult<Vec<LoreLayerRecord>>
pub fn update_lore_layer(&self, update: &LoreLayerUpdate) -> CoreResult<LoreLayerRecord>
pub fn archive_lore_layer(&self, archive: &LoreLayerArchive) -> CoreResult<LoreLayerRecord>
```

### 3.2 Layer-entry association

```rust
pub fn add_entry_to_layer(&self, link: &LayerEntryLink) -> CoreResult<()>
pub fn remove_entry_from_layer(&self, layer_id: &str, record_id: &str) -> CoreResult<()>
pub fn set_entry_constant(&self, layer_id: &str, record_id: &str, is_constant: bool) -> CoreResult<()>
pub fn list_entries_by_layer(&self, layer_id: &str) -> CoreResult<Vec<LayerEntryJoin>>
```

### 3.3 Chat-layer association

```rust
pub fn set_chat_layers(&self, write: &ChatLayersWrite) -> CoreResult<()>  // batch set for a chat
pub fn get_chat_layers(&self, chat_id: &str) -> CoreResult<Vec<ChatLayerRecord>>
pub fn toggle_chat_layer(&self, chat_id: &str, layer_id: &str, enabled: bool) -> CoreResult<()>
pub fn reorder_chat_layers(&self, chat_id: &str, layer_ids: &[String]) -> CoreResult<()>
```

### 3.4 Scored recall (THE KEY ADDITION)

This is the most important new feature — scored, token-budgeted retrieval across all active layers for a given chat.

```rust
pub fn recall_lore(
    &self,
    query: &LoreRecallQuery,
) -> CoreResult<LoreRecallResult>

// Where:
pub struct LoreRecallQuery {
    pub chat_id: String,
    pub query_text: Option<String>,        // FTS5 query (optional — empty = recent listing)
    pub active_subjects: Vec<String>,       // entity IDs to boost
    pub excluded_subjects: Vec<String>,     // entity IDs to penalize
    pub token_budget: Option<u32>,         // override default (from layer configs)
    pub record_trace_id: Option<String>,   // if set, record a recall trace entry
}

pub struct LoreRecallResult {
    pub entries: Vec<ScoredLoreEntry>,
    pub trace_id: Option<String>,
    pub constants: Vec<SimpleLoreEntry>,
    pub token_usage: RecallTokenUsage,
}

pub struct ScoredLoreEntry {
    pub record: RoleplayLoreRecord,
    pub score: f64,
    pub score_breakdown: ScoreBreakdown,
    pub layer_name: String,
}

pub struct ScoreBreakdown {
    pub fts_score: f64,
    pub subject_match_boost: f64,
    pub canon_weight: f64,
    pub layer_boost: f64,
    pub tag_boost: f64,
    pub recency_decay: f64,
}
```

**Recall algorithm:**

1. Load all enabled layers for `chat_id` (from `module_roleplay_chat_layers`), ordered by priority
2. For each layer, load its config from `module_roleplay_lore_layer_config`
3. **Phase 1 — Constants:** For each layer in priority order, query constant entries (up to `max_constants` per layer). These consume from the per-layer `constant_token_reserve`. Stop when per-layer reserve is exhausted.
4. **Phase 2 — Scored recall:** If `query_text` is provided, run FTS5 across `module_roleplay_lore_records_fts` with layer filter (via `module_roleplay_lore_layer_entries`). If no query, return recent entries across all layers (ordered by `updated_at DESC`, capped to budget).
5. **Scoring formula** (matches lorekeep Go model weights, adapted for layers):

```
score = fts_rank * config.fts_weight
       + subject_match * config.subject_weight
       + canon_level_multiplier * config.canon_weight
       + layer_boost     (from per-layer config)
       + tag_overlap * config.tag_boost_weight
       + recency_multiplier * config.recency_weight

Where:
  fts_rank = FTS5 bm25 rank (negated, 0..1 normalized)
  subject_match = 1 if any active_subject matches entity_id, 0 if excluded_subjects matches, 0.5 otherwise
  canon_level_multiplier = established:1.0, speculative:0.6, superseded:0.2, retired:0.0
  layer_boost = configured per-layer boost (default 0, can be positive or negative)
  tag_overlap = number of matching tokens from query_tags in the entry's content_json tags
  recency_multiplier = exp(-days_since_update / 30)  —  half-life ~21 days
```

6. **Budget enforcement:** Score all candidates, sort by score descending, take top entries until token budget exhausted. Skip entries below `min_relevance_score` even if budget remains.
7. **Trace recording:** If `record_trace_id` is provided, write a `module_roleplay_lore_recall_traces` row.

### 3.5 Fact capture and promotion

```rust
// Auto-capture: narrator writes a new lore record into the designated auto_capture layer
pub fn capture_lore_fact(&self, capture: &LoreFactCapture) -> CoreResult<RoleplayLoreRecord>

pub struct LoreFactCapture {
    pub profile_id: String,
    pub chat_id: String,
    pub auto_capture_layer_id: String,      // must have write_policy=auto_capture
    pub title: String,
    pub body: String,
    pub entity_id: Option<String>,
    pub tags: Vec<String>,                   // stored in content_json
    pub capture_reason: String,
    pub source: MemoryProposalSource,
    pub confidence: f64,
    pub now: IsoTimestamp,
}

// Promotion: copies an entry from one layer to another with provenance
pub fn promote_lore_entry(&self, promote: &LoreEntryPromote) -> CoreResult<LorePromoteResult>

pub struct LoreEntryPromote {
    pub source_layer_id: String,
    pub source_record_id: String,
    pub target_layer_id: String,             // must not be readonly
    pub new_record_id: String,               // ULID for the copy
    pub source: MemoryProposalSource,
    pub now: IsoTimestamp,
}

pub struct LorePromoteResult {
    pub source_record: RoleplayLoreRecord,   // unchanged
    pub target_record: RoleplayLoreRecord,   // new copy with provenance
}
```

Promotion creates a new `module_roleplay_lore_records` row with `supersedes_record_id` left null (it's a copy, not a replacement), `source` set to the original record's source, and a provenance event recording "promoted from {source_layer_id}:{source_record_id}".

### 3.6 Layer config CRUD

```rust
pub fn get_lore_layer_config(&self, layer_id: &str) -> CoreResult<Option<LoreLayerConfigRecord>>
pub fn set_lore_layer_config(&self, config: &LoreLayerConfigWrite) -> CoreResult<LoreLayerConfigRecord>
```

## 4. Native bridge surface

### 4.1 Profile memory pattern

Follow the exact same pattern as `listProfileMemory`/`addProfileMemory`/etc. Add these to `NativeBridge` and `NativeBridgeBinding`:

```
// Layer operations
createLoreLayer, getLoreLayer, listLoreLayers, updateLoreLayer, archiveLoreLayer
setChatLayers, getChatLayers, toggleChatLayer, reorderChatLayers

// Entry operations (wrap existing add/replace/supersede/tombstone)
addLoreEntry, replaceLoreEntry, supersedeLoreEntry, tombstoneLoreEntry
queryLoreEntries, addEntryToLayer, removeEntryFromLayer, setEntryConstant

// Recall (new)
recallLore

// Fact operations (new)
captureLoreFact, promoteLoreEntry

// Config (new)
getLoreLayerConfig, setLoreLayerConfig

// Diagnostics
listRecallTraces, getRecallTrace
```

### 4.2 JS type shapes

All JS types mirror the Rust types with camelCase conversion, following the existing JsProfileMemory* patterns.

## 5. TS brain tool definitions

### 5.1 New tool: `recall_lore`

The primary recall tool for the narrator agent. Scoped to a chat's active layers.

```typescript
{
  name: 'recall_lore',
  parameters: {
    chatId: string,                           // session/conversation id
    query: string,                             // FTS5 query text (optional)
    activeSubjects: string[],                  // entity IDs to boost
    excludedSubjects: string[],                // entity IDs to penalize
    tokenBudget?: number,                      // override budget
    recordTrace: boolean,                      // whether to persist a recall trace
  },
  returns: {
    entries: Array<{ record, score, scoreBreakdown, layerName }>,
    constants: Array<{ record, layerName }>,
    tokenUsage: { budget, consumed },
    traceId?: string,
  }
}
```

### 5.2 New tool: `capture_lore_fact`

For the narrator agent to autonomously record established facts.

```typescript
{
  name: 'capture_lore_fact',
  parameters: {
    chatId: string,
    title: string,
    body: string,
    entityId?: string,
    tags: string[],
    reason: string,
    confidence: number,                        // 0.0-1.0
  },
  // Targets the chat's auto_capture layer. If none exists, returns an error.
  returns: { record: RoleplayLoreRecord }
}
```

### 5.3 New tool: `promote_lore_entry`

For users (via UI) or the narrator to promote a fact from auto-capture to a permanent layer.

```typescript
{
  name: 'promote_lore_entry',
  parameters: {
    recordId: string,                           // source record
    sourceLayerId: string,
    targetLayerId: string,                      // must not be readonly
    targetRecordId?: string,                    // auto-generated if not provided
  },
  returns: { sourceRecord, targetRecord }
}
```

### 5.4 New tool: `search_lore`

FTS5 search across specified layers (or all active layers for a chat). For when the user or mechanic wants to browse.

```typescript
{
  name: 'search_lore',
  parameters: {
    query: string,
    layerIds?: string[],                        // if omitted, search all user's layers
    profileId: string,
    limit: number,
  },
  returns: { entries: Array<{ record, layerName }> }
}
```

### 5.5 New tool: `list_lore_layers`

Layer browsing for UI and mechanic agent.

```typescript
{
  name: 'list_lore_layers',
  parameters: {
    profileId: string,
    includeArchived: boolean,
    purpose?: string,                            // optional filter
    writePolicy?: string,                        // optional filter
  },
  returns: { layers: LoreLayer[] }
}
```

### 5.6 New tool: `manage_lore_layers`

For the UI (not the narrator) to create, toggle, reorder layers.

```typescript
{
  name: 'manage_lore_layers',
  parameters: {
    action: 'create' | 'update' | 'archive' | 'toggle' | 'reorder' | 'set_entry_constant',
    // action-specific params following the bridge API shape
    layer?: { name, description, purpose, writePolicy },
    chatLayers?: { chatId, layerIds: string[] },    // for 'reorder'
    toggle?: { chatId, layerId, enabled },          // for 'toggle'
  },
  returns: { /* action-specific */ }
}
```

### 5.7 New tool: `get_lore_layer_config`

Read retrieval config for diagnostic/debug purposes. Used by the mechanic agent.

```typescript
{
  name: 'get_lore_layer_config',
  parameters: { layerId: string },
  returns: { config: LoreLayerConfig }
}
```

## 6. Implementation order

This is the suggested build order — each step produces something testable before the next starts.

### Step 1: Schema migration v25

Add the three new tables (`lore_layer`, `layer_entry`, `chat_layer`, `recall_trace`, `layer_config`) and the FTS5 virtual table with sync triggers. No new CoordinationStore methods yet — just the SQL.

**Test:** Migration applies without error on existing databases. FTS5 triggers fire on insert/update/delete of existing lore records.

### Step 2: Layer CRUD + layer-config CRUD

Implement the CoordinationStore methods for layers (3.1) and layer config (3.6). These are CRUD operations following the existing pattern — straightforward.

**Test:** Can create, list, get, update, archive layers. Layer config can be set and read. Everything round-trips correctly.

### Step 3: Chat-layer association

Implement `set_chat_layers`, `get_chat_layers`, `toggle_chat_layer`, `reorder_chat_layers`.

**Test:** Can assign layers to a chat, toggle them on/off, reorder. Query returns layers in priority order.

### Step 4: Layer-entry association

Implement `add_entry_to_layer`, `remove_entry_from_layer`, `set_entry_constant`, `list_entries_by_layer`. These wrap existing `module_roleplay_lore_records` CRUD with the layer-indexing layer.

**Test:** Can link existing lore records to layers, mark some as constant, list by layer. Constant entries are flagged correctly.

### Step 5: Recall + scoring (THE KEY ONE)

Implement `recall_lore` with the full scoring algorithm, token budgeting, and trace recording.

**Test:** Seed test lore across two layers (one world detail layer, one story layer). Run recall with various queries and verify:
- Constants are returned with correct priority ordering
- FTS5 scoring ranks relevant entries higher
- Subject boost works (matching entity_id gets higher score)
- Subject exclusion works (excluded entity_id entries are penalized)
- Budget enforcement cuts off low-scoring entries
- Trace is recorded when requested

### Step 6: Fact capture + promotion

Implement `capture_lore_fact` and `promote_lore_entry`.

**Test:** Capture a fact into an auto_capture layer — verify write policy enforcement (reject write to manual/readonly layers). Promote to a permanent layer — verify copy is created with correct provenance. Promote to a readonly layer is rejected.

### Step 7: Native bridge

Expose all new methods through `NativeBridge` + `NativeBridgeBinding`.

**Test:** smoke-memory-space-api.ts tests pass for all new operations.

### Step 8: TS brain tool definitions

Create the TS tools in `brain-island/src/` following the `dense_profile_memory` pattern, register in `tool-registry.ts`.

**Test:** Tools are registered and callable from a basic narrator profile. Recall returns expected results.

## 7. Migration path

### Existing lorekeep Go data

When migrating from lorekeep Go:
- Each Go `campaign` → a `lore_layer` with purpose=mixed, write_policy=manual
- Each Go `entry` → added to existing `module_roleplay_lore_records` (via the existing add method) + linked to the layer via `module_roleplay_lore_layer_entries`
- Each profile gets a default auto_capture `lore_layer` created
- Existing lorekeep `config` → `module_roleplay_lore_layer_config` (schema translation: campaign token_budget → default_token_budget, campaign scoring_weights → fts_weight/subject_weight/etc.)

### Existing v24 data

Any records already in `module_roleplay_lore_records` (from the v24 migration) are valid. Their `world_id` becomes the layer_id after migration. A post-migration script creates a `lore_layer` row for each distinct `world_id` in the existing records and links them.

## 8. Key design decisions

1. **Layers are thin: most logic lives in entries.** Layers are just a grouping mechanism with a write policy and retrieval config. The heavy logic (scoring, provenance, supersession, tombstoning) is in the existing record infrastructure.

2. **Chat-layer association is per-chat.** Each session/conversation independently selects its active layers with priority ordering. No shared global state.

3. **FTS5 as optional capability.** The `module_roleplay_lore_records_fts` table is created by the migration but its absence shouldn't crash the service. `recall_lore` should degrade gracefully (text search = empty results) if FTS5 is unavailable.

4. **One auto_capture layer per chat.** The UI enforces at most one auto_capture layer per chat. Multiple chats can share an auto_capture layer (for layer inheritance: old chat's auto_capture becomes a reference layer in new chat).

5. **Scoring weights are per-layer.** Each layer can tune its own scoring: a world-detail layer might weight canon_level heavily (only show established lore), while a story layer might weight recency (prioritize recent events).
