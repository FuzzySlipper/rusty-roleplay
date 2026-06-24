package lore

import (
	"errors"
	"regexp"
)

// ErrInvalid is returned when a domain value fails validation.
var ErrInvalid = errors.New("invalid lore value")

var slugPattern = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)

// ValidSlug reports whether s is a well-formed slug.
func ValidSlug(s string) bool {
	return slugPattern.MatchString(s)
}

// Entry is an authored lore entry or an established fact, scoped to a
// profile + campaign. Field shapes mirror entry.schema.json.
type Entry struct {
	ID                   int64          `json:"id,omitempty"`
	ProfileID            string         `json:"profile_id"`
	Slug                 string         `json:"slug"`
	CampaignID           string         `json:"campaign_id"`
	Title                string         `json:"title"`
	Summary              string         `json:"summary"`
	BodyMD               string         `json:"body_md"`
	ContentFormat        string         `json:"content_format"`
	EntryKind            EntryKind      `json:"entry_kind"`
	SubjectKind          SubjectKind    `json:"subject_kind"`
	SubjectRefs          []string       `json:"subject_refs"`
	CanonLevel           CanonLevel     `json:"canon_level"`
	Tags                 []string       `json:"tags"`
	Constant             bool           `json:"constant"`
	DiscoveryScope       CampaignScope  `json:"discovery_scope"`
	EstablishedInSession *string        `json:"established_in_session"`
	EstablishedInTurn    *int           `json:"established_in_turn"`
	CapturedBy           *CapturedBy    `json:"captured_by"`
	CaptureReason        *CaptureReason `json:"capture_reason"`
	Status               EntryStatus    `json:"status"`
	Version              int            `json:"version"`
	CreatedAt            string         `json:"created_at,omitempty"`
	UpdatedAt            string         `json:"updated_at,omitempty"`
	CreatedBy            string         `json:"created_by,omitempty"`
	UpdatedBy            string         `json:"updated_by,omitempty"`
}

// Validate checks the entry's closed-vocabulary fields and required shape.
func (e *Entry) Validate() error {
	switch {
	case e.ProfileID == "":
		return wrap("profile_id is required")
	case !ValidSlug(e.Slug):
		return wrap("slug must match ^[a-z0-9]+(-[a-z0-9]+)*$")
	case e.CampaignID == "":
		return wrap("campaign_id is required")
	case e.Title == "":
		return wrap("title is required")
	case e.Summary == "":
		return wrap("summary is required")
	case e.ContentFormat != "markdown":
		return wrap("content_format must be markdown")
	case !e.EntryKind.IsValid():
		return wrap("invalid entry_kind")
	case !e.SubjectKind.IsValid():
		return wrap("invalid subject_kind")
	case !e.CanonLevel.IsValid():
		return wrap("invalid canon_level")
	case !e.DiscoveryScope.IsValid():
		return wrap("invalid discovery_scope")
	case !e.Status.IsValid():
		return wrap("invalid status")
	}
	if e.CapturedBy != nil && !e.CapturedBy.IsValid() {
		return wrap("invalid captured_by")
	}
	if e.CaptureReason != nil && !e.CaptureReason.IsValid() {
		return wrap("invalid capture_reason")
	}
	return nil
}

// TopicNode is a graph node representing a world entity. Mirrors topic-node.schema.json.
type TopicNode struct {
	ID             int64         `json:"id,omitempty"`
	Slug           string        `json:"slug"`
	CampaignID     string        `json:"campaign_id"`
	Title          string        `json:"title"`
	Summary        string        `json:"summary"`
	NodeKind       NodeKind      `json:"node_kind"`
	CanonLevel     CanonLevel    `json:"canon_level"`
	DiscoveryScope CampaignScope `json:"discovery_scope"`
	Tags           []string      `json:"tags"`
}

// TopicEdge is a typed, directed edge between two nodes. Mirrors topic-edge.schema.json.
type TopicEdge struct {
	ID            int64        `json:"id,omitempty"`
	CampaignID    string       `json:"campaign_id"`
	FromSlug      string       `json:"from_slug"`
	ToSlug        string       `json:"to_slug"`
	Relation      EdgeRelation `json:"relation"`
	EdgeDepthHint int          `json:"edge_depth_hint,omitempty"`
}

// Campaign is the lore isolation boundary. Mirrors campaign.schema.json.
type Campaign struct {
	ID          string `json:"id"`
	ProfileID   string `json:"profile_id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at,omitempty"`
}

// RetrievalConfig is the per-campaign control surface. Mirrors retrieval-config.schema.json.
type RetrievalConfig struct {
	CampaignID              string                   `json:"campaign_id"`
	Strategy                RetrievalStrategy        `json:"strategy,omitempty"`
	RetrievalDepth          RetrievalDepth           `json:"retrieval_depth"`
	MinScore                float64                  `json:"min_score"`
	TokenBudget             int                      `json:"token_budget"`
	CanonFilter             []CanonLevel             `json:"canon_filter"`
	TagBoosts               map[string]float64       `json:"tag_boosts,omitempty"`
	ScopeFilter             map[string]bool          `json:"scope_filter,omitempty"`
	RecencyWeighting        float64                  `json:"recency_weighting,omitempty"`
	ReciprocalScopeHandling *ReciprocalScopeHandling `json:"reciprocal_scope_handling,omitempty"`
}

// ReciprocalScopeHandling tunes how co-mentioned and excluded subjects are scored.
type ReciprocalScopeHandling struct {
	CoMentionedBoost       float64 `json:"co_mentioned_boost"`
	ExcludedSubjectPenalty float64 `json:"excluded_subject_penalty"`
}

func wrap(msg string) error {
	return errors.Join(ErrInvalid, errors.New(msg))
}
