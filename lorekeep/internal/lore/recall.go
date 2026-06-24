package lore

// RecallRequest is a scored, budgeted recall query. Mirrors recall-request.schema.json.
type RecallRequest struct {
	ProfileID        string           `json:"profile_id"`
	CampaignID       string           `json:"campaign_id"`
	Query            string           `json:"query"`
	ActiveSubjects   []string         `json:"active_subjects,omitempty"`
	ExcludedSubjects []string         `json:"excluded_subjects,omitempty"`
	Limit            int              `json:"limit,omitempty"`
	TokenBudget      int              `json:"token_budget,omitempty"`
	ConfigOverrides  *ConfigOverrides `json:"config_overrides,omitempty"`
}

// ConfigOverrides lets a single recall request override campaign config.
type ConfigOverrides struct {
	Strategy         RetrievalStrategy  `json:"strategy,omitempty"`
	RetrievalDepth   RetrievalDepth     `json:"retrieval_depth,omitempty"`
	MinScore         *float64           `json:"min_score,omitempty"`
	CanonFilter      []CanonLevel       `json:"canon_filter,omitempty"`
	TagBoosts        map[string]float64 `json:"tag_boosts,omitempty"`
	RecencyWeighting *float64           `json:"recency_weighting,omitempty"`
}

// RecallPacket is the scored, budgeted recall response. Mirrors recall-packet.schema.json.
type RecallPacket struct {
	PacketID         string         `json:"packet_id"`
	Entries          []PacketEntry  `json:"entries"`
	Skipped          []SkippedEntry `json:"skipped"`
	TokenBudget      int            `json:"token_budget"`
	TokensUsed       int            `json:"tokens_used"`
	ScoringProfile   string         `json:"scoring_profile,omitempty"`
	RetrievalTraceID string         `json:"retrieval_trace_id"`
}

// PacketEntry is one scored entry in a recall packet.
type PacketEntry struct {
	Slug        string     `json:"slug"`
	Title       string     `json:"title"`
	Summary     string     `json:"summary,omitempty"`
	BodyMD      string     `json:"body_md,omitempty"`
	Score       float64    `json:"score"`
	CanonLevel  CanonLevel `json:"canon_level,omitempty"`
	EntryKind   EntryKind  `json:"entry_kind,omitempty"`
	SubjectRefs []string   `json:"subject_refs,omitempty"`
	Tags        []string   `json:"tags,omitempty"`
	MatchReason string     `json:"match_reason,omitempty"`
}

// SkippedEntry records why a candidate was not included.
type SkippedEntry struct {
	Slug   string           `json:"slug"`
	Reason RetrievalOutcome `json:"reason"`
}

// RetrievalTrace is the per-retrieval diagnostic record. Mirrors retrieval-trace.schema.json.
type RetrievalTrace struct {
	ID                string              `json:"id"`
	TurnID            int                 `json:"turn_id"`
	RPSessionID       string              `json:"rp_session_id"`
	Timestamp         string              `json:"timestamp"`
	Queries           []string            `json:"queries"`
	EntriesConsidered []ConsideredEntry   `json:"entries_considered"`
	SceneBrief        SceneBrief          `json:"scene_brief"`
	ConfigSnapshot    TraceConfigSnapshot `json:"config_snapshot"`
}

// ConsideredEntry records the scoring decision for one candidate.
type ConsideredEntry struct {
	Slug      string           `json:"slug"`
	Score     float64          `json:"score"`
	Retrieved bool             `json:"retrieved"`
	Reason    RetrievalOutcome `json:"reason"`
}

// SceneBrief summarizes what the trace's recall assembled.
type SceneBrief struct {
	EntriesIncluded []string `json:"entries_included"`
	TokenBudget     int      `json:"token_budget"`
	TokensUsed      int      `json:"tokens_used"`
	TonalNotes      string   `json:"tonal_notes,omitempty"`
}

// TraceConfigSnapshot captures the retrieval config at trace time.
type TraceConfigSnapshot struct {
	Strategy         RetrievalStrategy  `json:"strategy,omitempty"`
	RetrievalDepth   RetrievalDepth     `json:"retrieval_depth"`
	MinScore         float64            `json:"min_score"`
	CanonFilter      []CanonLevel       `json:"canon_filter"`
	TagBoosts        map[string]float64 `json:"tag_boosts,omitempty"`
	RecencyWeighting float64            `json:"recency_weighting,omitempty"`
}

// FactCapture is the request to capture an established fact. Mirrors fact-capture.schema.json.
type FactCapture struct {
	ProfileID            string        `json:"profile_id"`
	CampaignID           string        `json:"campaign_id"`
	Slug                 string        `json:"slug"`
	Title                string        `json:"title"`
	Summary              string        `json:"summary"`
	BodyMD               string        `json:"body_md"`
	SubjectRefs          []string      `json:"subject_refs,omitempty"`
	Tags                 []string      `json:"tags,omitempty"`
	CanonLevel           CanonLevel    `json:"canon_level"`
	EstablishedInSession string        `json:"established_in_session"`
	EstablishedInTurn    int           `json:"established_in_turn"`
	CapturedBy           CapturedBy    `json:"captured_by"`
	CaptureReason        CaptureReason `json:"capture_reason"`
	CaptureNote          string        `json:"capture_note,omitempty"`
}

// Validate checks a fact capture's required fields and vocabularies.
func (f *FactCapture) Validate() error {
	switch {
	case f.ProfileID == "":
		return wrap("profile_id is required")
	case f.CampaignID == "":
		return wrap("campaign_id is required")
	case !ValidSlug(f.Slug):
		return wrap("slug must match ^[a-z0-9]+(-[a-z0-9]+)*$")
	case f.Title == "":
		return wrap("title is required")
	case f.Summary == "":
		return wrap("summary is required")
	case !f.CanonLevel.IsValid():
		return wrap("invalid canon_level")
	case f.EstablishedInSession == "":
		return wrap("established_in_session is required")
	case !f.CapturedBy.IsValid():
		return wrap("invalid captured_by")
	case !f.CaptureReason.IsValid():
		return wrap("invalid capture_reason")
	}
	return nil
}

// FactPromotion is the request to promote a fact toward canon. Mirrors fact-promotion.schema.json.
type FactPromotion struct {
	ProfileID    string     `json:"profile_id"`
	CampaignID   string     `json:"campaign_id"`
	Slug         string     `json:"slug"`
	ToCanonLevel CanonLevel `json:"to_canon_level"`
	PromotedBy   CapturedBy `json:"promoted_by"`
	Note         string     `json:"note,omitempty"`
}
