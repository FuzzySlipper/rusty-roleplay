package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/FuzzySlipper/rusty-roleplay/lorekeep/internal/lore"
)

// GetConfig returns the retrieval config for a campaign, or ErrNotFound.
func (s *Store) GetConfig(ctx context.Context, campaignID string) (*lore.RetrievalConfig, error) {
	var raw string
	err := s.db.QueryRowContext(ctx,
		`SELECT config_json FROM retrieval_configs WHERE campaign_id=?`, campaignID).Scan(&raw)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get config: %w", err)
	}
	var cfg lore.RetrievalConfig
	if err := json.Unmarshal([]byte(raw), &cfg); err != nil {
		return nil, fmt.Errorf("decode config: %w", err)
	}
	cfg.CampaignID = campaignID
	return &cfg, nil
}

// PutConfig upserts the retrieval config for a campaign.
func (s *Store) PutConfig(ctx context.Context, cfg *lore.RetrievalConfig) error {
	data, err := json.Marshal(cfg)
	if err != nil {
		return fmt.Errorf("encode config: %w", err)
	}
	_, err = s.db.ExecContext(ctx, `
		INSERT INTO retrieval_configs (campaign_id, config_json, updated_at)
		VALUES (?,?,datetime('now'))
		ON CONFLICT (campaign_id) DO UPDATE SET config_json=excluded.config_json, updated_at=datetime('now')`,
		cfg.CampaignID, string(data))
	if err != nil {
		return fmt.Errorf("put config: %w", err)
	}
	return nil
}
