package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/FuzzySlipper/rusty-roleplay/lorekeep/internal/lore"
)

// InsertTrace persists a retrieval trace.
func (s *Store) InsertTrace(ctx context.Context, campaignID string, t *lore.RetrievalTrace) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO retrieval_traces (id, campaign_id, turn_id, rp_session_id, queries_json,
			entries_considered_json, scene_brief_json, config_snapshot_json, created_at)
		VALUES (?,?,?,?,?,?,?,?,?)`,
		t.ID, campaignID, t.TurnID, t.RPSessionID, marshalJSON(t.Queries),
		marshalJSON(t.EntriesConsidered), marshalJSON(t.SceneBrief), marshalJSON(t.ConfigSnapshot), t.Timestamp)
	if err != nil {
		return fmt.Errorf("insert trace: %w", err)
	}
	return nil
}

// GetTrace returns a single trace by id.
func (s *Store) GetTrace(ctx context.Context, id string) (*lore.RetrievalTrace, error) {
	row := s.db.QueryRowContext(ctx,
		`SELECT id, turn_id, rp_session_id, queries_json, entries_considered_json,
		 scene_brief_json, config_snapshot_json, created_at FROM retrieval_traces WHERE id=?`, id)
	trace, err := scanTrace(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return trace, err
}

// TracesBySession returns traces for an RP session, newest first.
func (s *Store) TracesBySession(ctx context.Context, sessionID string, limit int) ([]lore.RetrievalTrace, error) {
	if limit <= 0 {
		limit = 25
	}
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, turn_id, rp_session_id, queries_json, entries_considered_json,
		 scene_brief_json, config_snapshot_json, created_at FROM retrieval_traces
		 WHERE rp_session_id=? ORDER BY created_at DESC LIMIT ?`, sessionID, limit)
	if err != nil {
		return nil, fmt.Errorf("traces by session: %w", err)
	}
	defer rows.Close()
	var traces []lore.RetrievalTrace
	for rows.Next() {
		trace, err := scanTrace(rows)
		if err != nil {
			return nil, err
		}
		traces = append(traces, *trace)
	}
	return traces, rows.Err()
}

func scanTrace(row scanner) (*lore.RetrievalTrace, error) {
	var (
		t          lore.RetrievalTrace
		queries    string
		considered string
		sceneBrief string
		config     string
	)
	if err := row.Scan(&t.ID, &t.TurnID, &t.RPSessionID, &queries, &considered, &sceneBrief, &config, &t.Timestamp); err != nil {
		return nil, err
	}
	_ = json.Unmarshal([]byte(queries), &t.Queries)
	_ = json.Unmarshal([]byte(considered), &t.EntriesConsidered)
	_ = json.Unmarshal([]byte(sceneBrief), &t.SceneBrief)
	_ = json.Unmarshal([]byte(config), &t.ConfigSnapshot)
	return &t, nil
}
