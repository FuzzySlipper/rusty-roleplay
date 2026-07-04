# Lore Layer Design

**Status:** Draft design note
**Date:** 2026-06-26
**Context:** Replaces the Go `campaign` model with flexible lore layers. Written during Den MCP outage — will be moved to Den when service is back.

## The core insight

Lore is not a single bucket. Users have multiple categories of knowledge with different durability, write policies, and lifecycle expectations. The system should model this as **lore layers** — named collections of entries that can be independently enabled, ordered, inherited, and promoted between.

## Lore layers vs the Go model

The Go `campaign` concept was in the right direction but wrong: campaigns are a PnP RPG framing (campaign-specific, throwaway, singular). Users accumulate and compose lore across sessions, not per-campaign. The replacement is **layers**.

## Data model

### Layer

```sql
create table layer (
    id          text primary key,       -- ULID
    profile_id  text not null,           -- which user profile owns this
    name        text not null,           -- "World Details", "Current Story", "Auto-Captured"
    description text,                    -- what this layer is for
    purpose     text not null default 'mixed',
        -- 'world' | 'story' | 'characters' | 'factions' | 'mixed'

    write_policy text not null default 'manual',
        -- 'manual' — narrator cannot write here, only via UI or promote
        -- 'auto_capture' — narrator can create entries here during generation
        -- 'readonly' — immutable reference layer (preserved import, never changes)

    created_at  integer not null,
    updated_at  integer not null
);
```

### Entry (belongs to exactly one layer)

```sql
create table lore_entry (
    id          text primary key,       -- ULID
    layer_id    text not null references layer(id),
    slug        text not null,          -- human-readable unique ref, e.g. "city-of-aether"
    title       text not null,
    summary     text,                    -- optional short summary for tooltip/preview
    body        text not null,          -- markdown content, the actual lore
    tags        text not null default '[]',      -- JSON array

    -- Subject references: links entries to named entities for topic filtering
    subject_refs text not null default '[]',     -- JSON array, e.g. ["city", "faction:house-aether"]

    -- Canon state
    canon_level  text not null default 'established',
        -- 'established' — solid, accepted lore
        -- 'speculative' — in-universe speculation, not yet confirmed
        -- 'superseded' — this entry was true but has been overwritten/replaced
        -- 'retired' — no longer relevant

    -- Provenance: where this entry came from
    provenance text,                     -- e.g. "auto_captured from chat {uuid}", "migrated from ST"
    capture_reason text,                 -- for auto_captured entries: what triggered the capture

    -- Optional supersession chain
    superseded_by_entry_id text references lore_entry(id),

    created_at  integer not null,
    updated_at  integer not null,

    unique(layer_id, slug)
);
```

### Chat-layer association

```sql
create table chat_layer (
    chat_id     text not null,          -- conversation/session id
    layer_id    text not null references layer(id),
    priority    integer not null default 0,  -- lower = fetched first during recall
    enabled     integer not null default 1,  -- toggle on/off
    created_at  integer not null,
    primary key (chat_id, layer_id)
);
```

### Retrieval config (per-layer)

```sql
create table layer_config (
    id                  text primary key,
    layer_id            text not null unique references layer(id),
    -- scoring weights
    fts_weight          real not null default 1.0,
    subject_weight      real not null default 1.0,
    canon_weight        real not null default 0.5,
    tag_boost_weight    real not null default 0.5,
    recency_weight      real not null default 0.2,
    -- budgets
    default_token_budget   integer not null default 4000,
    constant_token_reserve integer not null default 500,
    -- eligibility
    min_relevance_score    real not null default 0.3,
    max_constants          integer not null default 5
);
```

## Write policies & how they govern the narrator

When the narrator says "capture that fact," the system checks the active layers' write policies:

| Policy | Narrator can write? | UI can write? | Promotion accepted? |
|--------|--------------------|---------------|--------------------|
| `manual` | No | Yes | Yes |
| `auto_capture` | Yes (via `capture_fact` tool) | Yes | Yes |
| `readonly` | No | No | No |

Only **one** active layer per chat should have `auto_capture` policy. The narrator's `capture_fact` tool targets the auto-capture layer by default.

## Promotion

Promotion copies an entry from one layer to another, with provenance tracking:

- Source entry → new entry in target layer
- Preserves body, tags, subject_refs
- Sets provenance to "promoted from {source_layer.name} at {timestamp}"
- Original entry stays in the source layer (not moved)
- Target layer must have a write policy that permits the promotion (`readonly` layers reject promotions)

**UI actions:**
- "Promote to..." button on any entry in an auto-capture layer
- Target layer picker (shows only eligible layers)
- "Promote and keep" (copy) or "Promote and archive source" (copy + set source entry to retired status)

## Layer lifecycle

### Layer creation
Users create layers with a name, description, write policy, and purpose. A new user profile starts with at least one `auto_capture` layer.

### Layer inheritance ("bring the old auto layer along")
When a user starts a new chat for the same story:
1. Previous chat's auto-capture layer is visible in the layer picker
2. User toggles it on as a reference layer (read-only by convention)
3. User creates (or selects) an auto-capture layer for the new chat
4. The old layer's entries are available for recall but no longer auto-writable
5. This is the key continuity mechanism — the old story facts keep showing up in context

### Layer merging
If two layers have become intertwined (e.g., character details in two different layers), a merge action:
1. Copies all entries from source layer to target layer
2. Handles slug conflicts (renames source entries, sets provenance)
3. Archives source layer (entries still referenced by trace records)

### Layer archiving
Archiving a layer removes it from active recall but preserves its data. Entries can still be searched explicitly and traces still reference them. Archiving is reversible.

## Recall across multiple layers

When generating for a chat, recall queries are scoped to all **enabled** layers for that chat:

1. Collect all active layers for the chat, ordered by `priority`
2. For each layer, query constant entries (layer-respecting priority order)
3. For scored recall, query FTS5 across all active layers (single query with layer filter) and apply scoring uniformly
4. Token budget is shared across layers — the recall packet includes entries from all layers, not separate per-layer packets

This means multiple layers compose naturally: a world layer's geography and a story layer's recent political developments both inform the same generation.

## Comparison to ST's world info

ST models lore as:
- **Books** (a flat list of entries)
- **Global / per-character / per-chat** scoping
- Entries have keys/secondary keys for activation
- No write policies, no promotion, no chaining

Lore layers replace this with:
- **Layers** instead of books (typed, write-policy-aware, inheritable)
- **Active layers per chat** instead of scoping types (more flexible than three hardcoded scopes)
- **Scored recall** instead of keyword activation (no key-typing tedium)
- **Promotion chain** for the user workflow they actually use (tweak fact capture → promote to permanent)

## Migration from lorekeep Go

The Go model's `campaign` maps to a **layer** with purpose `mixed` and write policy `manual`. Entries in that campaign carry over with their layer_id. No data loss.

The migration creates a second layer (`auto_capture`) for each profile on import, with write policy `auto_capture`. The user can then promote entries between them as they wish.

## Open questions

1. **Layer visibility across profiles** — should layers be shareable between sibling profiles? Both users RP in the same world. Probably not in v1 — each profile has its own layer set, export/import for sharing.
2. **Entry slug collision across layers** — two layers may have entries with the same slug (different detail level). Fine during recall (different provenance). Promotion copies with deduplicated slug.
3. **Layer ordering priority** — lower number = fetched first. Affects which constants get dropped in over-budget scenarios.
4. **Maximum active layers per chat** — practical limit of 5-6 before token budget fragmentation. UI should warn.
