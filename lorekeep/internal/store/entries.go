package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/FuzzySlipper/rusty-roleplay/lorekeep/internal/lore"
)

const entryColumns = `id, profile_id, campaign_id, slug, title, summary, body_md, content_format,
	entry_kind, subject_kind, subject_refs_json, canon_level, tags_json, constant,
	discovery_scope, established_in_session, established_in_turn, captured_by, capture_reason,
	status, version, created_at, updated_at, created_by, updated_by`

// EntryMatch is an entry plus its FTS rank (raw bm25; more negative = stronger).
type EntryMatch struct {
	Entry   lore.Entry
	FTSRank float64
}

// CreateEntry inserts a new entry and returns its id.
func (s *Store) CreateEntry(ctx context.Context, e *lore.Entry) (int64, error) {
	res, err := s.db.ExecContext(ctx, `
		INSERT INTO lore_entries (
			profile_id, campaign_id, slug, title, summary, body_md, content_format,
			entry_kind, subject_kind, subject_refs_json, canon_level, tags_json, tags_text,
			constant, discovery_scope, established_in_session, established_in_turn,
			captured_by, capture_reason, status, version, created_by, updated_by
		) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		e.ProfileID, e.CampaignID, e.Slug, e.Title, e.Summary, e.BodyMD, e.ContentFormat,
		string(e.EntryKind), string(e.SubjectKind), marshalStrings(e.SubjectRefs), string(e.CanonLevel),
		marshalStrings(e.Tags), strings.Join(e.Tags, " "), boolToInt(e.Constant), string(e.DiscoveryScope),
		nullString(e.EstablishedInSession), nullInt(e.EstablishedInTurn),
		nullCapturedBy(e.CapturedBy), nullCaptureReason(e.CaptureReason),
		string(e.Status), maxInt(e.Version, 1), e.CreatedBy, e.UpdatedBy)
	if err != nil {
		return 0, fmt.Errorf("insert entry: %w", err)
	}
	return res.LastInsertId()
}

// GetEntry returns a single entry by its (profile, campaign, slug) identity.
func (s *Store) GetEntry(ctx context.Context, profileID, campaignID, slug string) (*lore.Entry, error) {
	row := s.db.QueryRowContext(ctx,
		`SELECT `+entryColumns+` FROM lore_entries WHERE profile_id=? AND campaign_id=? AND slug=?`,
		profileID, campaignID, slug)
	entry, err := scanEntry(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return entry, nil
}

// UpdateEntry applies a versioned update to an authored entry, incrementing
// version and refreshing updated_at/updated_by. Returns ErrNotFound if absent.
//
// v0 uses a simple version counter (edit-in-place, no history table), matching
// den-memory. Full prior-revision history is a deliberate future extension.
func (s *Store) UpdateEntry(ctx context.Context, e *lore.Entry) error {
	res, err := s.db.ExecContext(ctx, `
		UPDATE lore_entries SET
			title=?, summary=?, body_md=?, subject_kind=?, subject_refs_json=?,
			canon_level=?, tags_json=?, tags_text=?, constant=?, discovery_scope=?,
			status=?, version=version+1, updated_at=datetime('now'), updated_by=?
		WHERE profile_id=? AND campaign_id=? AND slug=?`,
		e.Title, e.Summary, e.BodyMD, string(e.SubjectKind), marshalStrings(e.SubjectRefs),
		string(e.CanonLevel), marshalStrings(e.Tags), strings.Join(e.Tags, " "), boolToInt(e.Constant),
		string(e.DiscoveryScope), string(e.Status), e.UpdatedBy,
		e.ProfileID, e.CampaignID, e.Slug)
	if err != nil {
		return fmt.Errorf("update entry: %w", err)
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return ErrNotFound
	}
	return nil
}

// PromoteFact raises the canon_level of an established fact. Returns ErrNotFound
// if the entry does not exist or is not an established_fact.
func (s *Store) PromoteFact(ctx context.Context, profileID, campaignID, slug string, to lore.CanonLevel, by lore.CapturedBy) error {
	res, err := s.db.ExecContext(ctx, `
		UPDATE lore_entries SET canon_level=?, updated_at=datetime('now'), updated_by=?
		WHERE profile_id=? AND campaign_id=? AND slug=? AND entry_kind='established_fact'`,
		string(to), string(by), profileID, campaignID, slug)
	if err != nil {
		return fmt.Errorf("promote fact: %w", err)
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return ErrNotFound
	}
	return nil
}

// SearchEntries runs an FTS query (or a recency listing when the query has no
// usable tokens) scoped to a profile + campaign.
func (s *Store) SearchEntries(ctx context.Context, profileID, campaignID, query string, tags []string, limit int) ([]lore.Entry, error) {
	matches, err := s.RecallCandidates(ctx, profileID, campaignID, query, limit)
	if err != nil {
		return nil, err
	}
	entries := make([]lore.Entry, 0, len(matches))
	for _, m := range matches {
		if len(tags) > 0 && !hasAnyTag(m.Entry.Tags, tags) {
			continue
		}
		entries = append(entries, m.Entry)
	}
	return entries, nil
}

// RecallCandidates returns entries matching the query (FTS-ranked) or, when the
// query is empty, the most recent active entries. Used by the recall service.
func (s *Store) RecallCandidates(ctx context.Context, profileID, campaignID, query string, limit int) ([]EntryMatch, error) {
	if limit <= 0 {
		limit = 25
	}
	expr := ftsMatchExpr(query)
	if expr == "" {
		return s.listRecent(ctx, profileID, campaignID, limit)
	}
	rows, err := s.db.QueryContext(ctx, `
		SELECT `+prefixed("e", entryColumns)+`, bm25(lore_entries_fts) AS rank
		FROM lore_entries_fts
		JOIN lore_entries e ON e.id = lore_entries_fts.rowid
		WHERE lore_entries_fts MATCH ? AND e.profile_id=? AND e.campaign_id=?
		ORDER BY rank LIMIT ?`,
		expr, profileID, campaignID, limit)
	if err != nil {
		return nil, fmt.Errorf("fts query: %w", err)
	}
	defer rows.Close()
	return scanMatches(rows)
}

func (s *Store) listRecent(ctx context.Context, profileID, campaignID string, limit int) ([]EntryMatch, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT `+entryColumns+`, 0.0 AS rank FROM lore_entries
		 WHERE profile_id=? AND campaign_id=? ORDER BY updated_at DESC LIMIT ?`,
		profileID, campaignID, limit)
	if err != nil {
		return nil, fmt.Errorf("list recent entries: %w", err)
	}
	defer rows.Close()
	return scanMatches(rows)
}

// ListConstantEntries returns active constant entries for a campaign — those
// always injected into the scene brief regardless of the query.
func (s *Store) ListConstantEntries(ctx context.Context, profileID, campaignID string) ([]lore.Entry, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT `+entryColumns+` FROM lore_entries
		 WHERE profile_id=? AND campaign_id=? AND constant=1 AND status='active'
		 ORDER BY updated_at DESC`,
		profileID, campaignID)
	if err != nil {
		return nil, fmt.Errorf("list constant entries: %w", err)
	}
	defer rows.Close()
	var entries []lore.Entry
	for rows.Next() {
		entry, err := scanEntry(rows)
		if err != nil {
			return nil, err
		}
		entries = append(entries, *entry)
	}
	return entries, rows.Err()
}

// ListEstablishedFacts returns established facts for a campaign, newest first.
func (s *Store) ListEstablishedFacts(ctx context.Context, profileID, campaignID string, limit int) ([]lore.Entry, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := s.db.QueryContext(ctx,
		`SELECT `+entryColumns+` FROM lore_entries
		 WHERE profile_id=? AND campaign_id=? AND entry_kind='established_fact'
		 ORDER BY created_at DESC LIMIT ?`,
		profileID, campaignID, limit)
	if err != nil {
		return nil, fmt.Errorf("list established facts: %w", err)
	}
	defer rows.Close()
	var entries []lore.Entry
	for rows.Next() {
		entry, err := scanEntry(rows)
		if err != nil {
			return nil, err
		}
		entries = append(entries, *entry)
	}
	return entries, rows.Err()
}

type scanner interface {
	Scan(dest ...any) error
}

func scanEntry(row scanner) (*lore.Entry, error) {
	var (
		e               lore.Entry
		subjectRefs     string
		tags            string
		constant        int
		entryKind       string
		subjectKind     string
		canonLevel      string
		discoveryScope  string
		status          string
		establishedIn   sql.NullString
		establishedTurn sql.NullInt64
		capturedBy      sql.NullString
		captureReason   sql.NullString
	)
	if err := row.Scan(
		&e.ID, &e.ProfileID, &e.CampaignID, &e.Slug, &e.Title, &e.Summary, &e.BodyMD, &e.ContentFormat,
		&entryKind, &subjectKind, &subjectRefs, &canonLevel, &tags, &constant,
		&discoveryScope, &establishedIn, &establishedTurn, &capturedBy, &captureReason,
		&status, &e.Version, &e.CreatedAt, &e.UpdatedAt, &e.CreatedBy, &e.UpdatedBy,
	); err != nil {
		return nil, err
	}
	e.EntryKind = lore.EntryKind(entryKind)
	e.SubjectKind = lore.SubjectKind(subjectKind)
	e.CanonLevel = lore.CanonLevel(canonLevel)
	e.DiscoveryScope = lore.CampaignScope(discoveryScope)
	e.Status = lore.EntryStatus(status)
	e.SubjectRefs = unmarshalStrings(subjectRefs)
	e.Tags = unmarshalStrings(tags)
	e.Constant = constant != 0
	if establishedIn.Valid {
		v := establishedIn.String
		e.EstablishedInSession = &v
	}
	if establishedTurn.Valid {
		v := int(establishedTurn.Int64)
		e.EstablishedInTurn = &v
	}
	if capturedBy.Valid {
		v := lore.CapturedBy(capturedBy.String)
		e.CapturedBy = &v
	}
	if captureReason.Valid {
		v := lore.CaptureReason(captureReason.String)
		e.CaptureReason = &v
	}
	return &e, nil
}

// scanMatches scans rows shaped as the entry columns followed by a trailing
// rank column (bm25 or a constant for recency listings).
func scanMatches(rows *sql.Rows) ([]EntryMatch, error) {
	var matches []EntryMatch
	for rows.Next() {
		var rank float64
		entry, err := scanEntry(&entryRankRow{rows: rows, rank: &rank})
		if err != nil {
			return nil, err
		}
		matches = append(matches, EntryMatch{Entry: *entry, FTSRank: rank})
	}
	return matches, rows.Err()
}

// entryRankRow reuses scanEntry for rows that carry a trailing rank column by
// appending the rank destination to the scan targets.
type entryRankRow struct {
	rows *sql.Rows
	rank *float64
}

func (r *entryRankRow) Scan(dest ...any) error {
	return r.rows.Scan(append(dest, r.rank)...)
}

func hasAnyTag(have, want []string) bool {
	set := map[string]struct{}{}
	for _, t := range have {
		set[t] = struct{}{}
	}
	for _, t := range want {
		if _, ok := set[t]; ok {
			return true
		}
	}
	return false
}

func prefixed(alias, columns string) string {
	parts := strings.Split(columns, ",")
	for i, p := range parts {
		parts[i] = alias + "." + strings.TrimSpace(p)
	}
	return strings.Join(parts, ", ")
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func nullString(p *string) any {
	if p == nil {
		return nil
	}
	return *p
}

func nullInt(p *int) any {
	if p == nil {
		return nil
	}
	return *p
}

func nullCapturedBy(p *lore.CapturedBy) any {
	if p == nil {
		return nil
	}
	return string(*p)
}

func nullCaptureReason(p *lore.CaptureReason) any {
	if p == nil {
		return nil
	}
	return string(*p)
}
