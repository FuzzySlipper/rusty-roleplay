package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/FuzzySlipper/rusty-roleplay/lorekeep/internal/lore"
)

// CreateCampaign inserts a campaign. The campaign id doubles as its slug and is
// the value referenced by lore_entries.campaign_id and retrieval_configs.
func (s *Store) CreateCampaign(ctx context.Context, c *lore.Campaign) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO campaigns (id, profile_id, name, description) VALUES (?,?,?,?)`,
		c.ID, c.ProfileID, c.Name, c.Description)
	if err != nil {
		return fmt.Errorf("create campaign: %w", err)
	}
	return nil
}

// GetCampaign returns a campaign by id.
func (s *Store) GetCampaign(ctx context.Context, id string) (*lore.Campaign, error) {
	row := s.db.QueryRowContext(ctx,
		`SELECT id, profile_id, name, description, created_at, updated_at FROM campaigns WHERE id=?`, id)
	c, err := scanCampaign(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return c, err
}

// ListCampaigns returns the campaigns owned by a profile, newest first.
func (s *Store) ListCampaigns(ctx context.Context, profileID string) ([]lore.Campaign, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, profile_id, name, description, created_at, updated_at
		 FROM campaigns WHERE profile_id=? ORDER BY created_at DESC`, profileID)
	if err != nil {
		return nil, fmt.Errorf("list campaigns: %w", err)
	}
	defer rows.Close()
	var campaigns []lore.Campaign
	for rows.Next() {
		c, err := scanCampaign(rows)
		if err != nil {
			return nil, err
		}
		campaigns = append(campaigns, *c)
	}
	return campaigns, rows.Err()
}

func scanCampaign(row scanner) (*lore.Campaign, error) {
	var c lore.Campaign
	var description sql.NullString
	if err := row.Scan(&c.ID, &c.ProfileID, &c.Name, &description, &c.CreatedAt, &c.UpdatedAt); err != nil {
		return nil, err
	}
	c.Description = description.String
	return &c, nil
}
