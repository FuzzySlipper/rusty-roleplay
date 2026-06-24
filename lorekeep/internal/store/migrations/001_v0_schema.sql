-- lorekeep v0 schema. Campaign-scoped RP lore storage with FTS5 search,
-- a topic graph, retrieval traces, and per-campaign retrieval config.
--
-- Enum columns carry CHECK constraints as a database-level integrity guarantee.
-- This is an intentional deviation from the "validate enums only in the app"
-- codestyle, matching den-memory: the app still validates via the registry's
-- IsValid() methods (lore/enums.go), and the CHECK is a defense-in-depth backstop.
-- The contracts/v0/registry.json closed vocabulary is the source of truth.

CREATE TABLE IF NOT EXISTS campaigns (
  id          TEXT PRIMARY KEY,
  profile_id  TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lore_entries (
  id                     INTEGER PRIMARY KEY,
  profile_id             TEXT NOT NULL,
  campaign_id            TEXT NOT NULL,
  slug                   TEXT NOT NULL,
  title                  TEXT NOT NULL,
  summary                TEXT NOT NULL DEFAULT '',
  body_md                TEXT NOT NULL DEFAULT '',
  content_format         TEXT NOT NULL DEFAULT 'markdown' CHECK (content_format IN ('markdown')),
  entry_kind             TEXT NOT NULL CHECK (entry_kind IN ('authored_lore','established_fact')),
  subject_kind           TEXT NOT NULL CHECK (subject_kind IN ('world_rule','character','location','faction','item','event','relationship')),
  subject_refs_json      TEXT NOT NULL DEFAULT '[]',
  canon_level            TEXT NOT NULL CHECK (canon_level IN ('canon','session_canon','rumor','deprecated','ambiguous')),
  tags_json              TEXT NOT NULL DEFAULT '[]',
  tags_text              TEXT NOT NULL DEFAULT '',
  constant               INTEGER NOT NULL DEFAULT 0 CHECK (constant IN (0,1)),
  discovery_scope        TEXT NOT NULL DEFAULT 'campaign' CHECK (discovery_scope IN ('campaign','character','location','faction','explicit_only')),
  established_in_session TEXT,
  established_in_turn    INTEGER,
  captured_by            TEXT CHECK (captured_by IS NULL OR captured_by IN ('rp_agent','mechanic_agent','user')),
  capture_reason         TEXT CHECK (capture_reason IS NULL OR capture_reason IN ('plot_event','relationship_change','revealed_information','character_development','user_override')),
  status                 TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','superseded','deprecated','archived')),
  version                INTEGER NOT NULL DEFAULT 1,
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now')),
  created_by             TEXT NOT NULL DEFAULT '',
  updated_by             TEXT NOT NULL DEFAULT '',
  UNIQUE (profile_id, campaign_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_lore_entries_campaign ON lore_entries (profile_id, campaign_id);

CREATE VIRTUAL TABLE IF NOT EXISTS lore_entries_fts USING fts5(
  title, summary, body_md, tags_text,
  content='lore_entries', content_rowid='id'
);

CREATE TRIGGER IF NOT EXISTS lore_entries_ai AFTER INSERT ON lore_entries BEGIN
  INSERT INTO lore_entries_fts(rowid, title, summary, body_md, tags_text)
  VALUES (new.id, new.title, new.summary, new.body_md, new.tags_text);
END;

CREATE TRIGGER IF NOT EXISTS lore_entries_ad AFTER DELETE ON lore_entries BEGIN
  INSERT INTO lore_entries_fts(lore_entries_fts, rowid, title, summary, body_md, tags_text)
  VALUES ('delete', old.id, old.title, old.summary, old.body_md, old.tags_text);
END;

CREATE TRIGGER IF NOT EXISTS lore_entries_au AFTER UPDATE ON lore_entries BEGIN
  INSERT INTO lore_entries_fts(lore_entries_fts, rowid, title, summary, body_md, tags_text)
  VALUES ('delete', old.id, old.title, old.summary, old.body_md, old.tags_text);
  INSERT INTO lore_entries_fts(rowid, title, summary, body_md, tags_text)
  VALUES (new.id, new.title, new.summary, new.body_md, new.tags_text);
END;

CREATE TABLE IF NOT EXISTS topic_nodes (
  id              INTEGER PRIMARY KEY,
  campaign_id     TEXT NOT NULL,
  slug            TEXT NOT NULL,
  title           TEXT NOT NULL,
  summary         TEXT NOT NULL DEFAULT '',
  node_kind       TEXT NOT NULL CHECK (node_kind IN ('character','location','faction','item','event','concept')),
  canon_level     TEXT NOT NULL CHECK (canon_level IN ('canon','session_canon','rumor','deprecated','ambiguous')),
  discovery_scope TEXT NOT NULL DEFAULT 'campaign' CHECK (discovery_scope IN ('campaign','character','location','faction','explicit_only')),
  tags_json       TEXT NOT NULL DEFAULT '[]',
  UNIQUE (campaign_id, slug)
);

CREATE TABLE IF NOT EXISTS topic_edges (
  id              INTEGER PRIMARY KEY,
  campaign_id     TEXT NOT NULL,
  from_node_id    INTEGER NOT NULL REFERENCES topic_nodes(id) ON DELETE CASCADE,
  to_node_id      INTEGER NOT NULL REFERENCES topic_nodes(id) ON DELETE CASCADE,
  relation        TEXT NOT NULL CHECK (relation IN ('member_of','located_in','rival_of','owns','knows_about','controls','parent_of','related_to')),
  edge_depth_hint INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_topic_edges_from ON topic_edges (from_node_id);

CREATE TABLE IF NOT EXISTS retrieval_traces (
  id                 TEXT PRIMARY KEY,
  campaign_id        TEXT NOT NULL,
  turn_id            INTEGER NOT NULL DEFAULT 0,
  rp_session_id      TEXT NOT NULL DEFAULT '',
  queries_json       TEXT NOT NULL DEFAULT '[]',
  entries_considered_json TEXT NOT NULL DEFAULT '[]',
  scene_brief_json   TEXT NOT NULL DEFAULT '{}',
  config_snapshot_json TEXT NOT NULL DEFAULT '{}',
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_traces_session ON retrieval_traces (rp_session_id, created_at);

CREATE TABLE IF NOT EXISTS retrieval_configs (
  campaign_id TEXT PRIMARY KEY,
  config_json TEXT NOT NULL DEFAULT '{}',
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
