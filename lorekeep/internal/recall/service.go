package recall

import (
	"context"
	"sort"
	"time"

	"github.com/FuzzySlipper/rusty-roleplay/lorekeep/internal/lore"
	"github.com/FuzzySlipper/rusty-roleplay/lorekeep/internal/store"
)

// Store is the storage surface the recall service depends on.
type Store interface {
	RecallCandidates(ctx context.Context, profileID, campaignID, query string, limit int) ([]store.EntryMatch, error)
	ListConstantEntries(ctx context.Context, profileID, campaignID string) ([]lore.Entry, error)
	GetConfig(ctx context.Context, campaignID string) (*lore.RetrievalConfig, error)
	InsertTrace(ctx context.Context, campaignID string, t *lore.RetrievalTrace) error
}

// Defaults are the service-level recall tunables (from typed config, not hardcoded).
type Defaults struct {
	TokenBudget   int
	MinScore      float64
	CharsPerToken int
	DepthLimits   map[lore.RetrievalDepth]int
}

// Service orchestrates a recall: gather candidates, score, filter, budget, trace.
type Service struct {
	store    Store
	scorer   *Scorer
	defaults Defaults
	now      func() time.Time
	newID    func(prefix string) string
}

// NewService constructs a recall service.
func NewService(s Store, scorer *Scorer, defaults Defaults, now func() time.Time, newID func(string) string) *Service {
	if defaults.CharsPerToken <= 0 {
		defaults.CharsPerToken = 4
	}
	if len(defaults.DepthLimits) == 0 {
		defaults.DepthLimits = map[lore.RetrievalDepth]int{
			lore.DepthShallow:  10,
			lore.DepthStandard: 25,
			lore.DepthDeep:     60,
		}
	}
	return &Service{store: s, scorer: scorer, defaults: defaults, now: now, newID: newID}
}

// Recall executes the request and returns the assembled packet.
func (svc *Service) Recall(ctx context.Context, req lore.RecallRequest) (*lore.RecallPacket, error) {
	cfg := svc.effectiveConfig(ctx, req)
	profile := svc.scorer.profileName(cfg.Strategy)

	limit := svc.defaults.DepthLimits[cfg.RetrievalDepth]
	if limit == 0 {
		limit = svc.defaults.DepthLimits[lore.DepthStandard]
	}
	candidates, err := svc.store.RecallCandidates(ctx, req.ProfileID, req.CampaignID, req.Query, limit)
	if err != nil {
		return nil, err
	}
	constants, err := svc.store.ListConstantEntries(ctx, req.ProfileID, req.CampaignID)
	if err != nil {
		return nil, err
	}

	canonAllowed := canonSet(cfg.CanonFilter)
	ftsScores := normalizeFTS(candidates)

	scored := make([]scoredEntry, 0, len(candidates))
	considered := make([]lore.ConsideredEntry, 0, len(candidates))
	skipped := []lore.SkippedEntry{}

	for i, match := range candidates {
		entry := match.Entry
		if entry.Status != lore.StatusActive {
			continue
		}
		if outcome, ok := filterCanon(entry, canonAllowed); !ok {
			skipped = append(skipped, lore.SkippedEntry{Slug: entry.Slug, Reason: outcome})
			considered = append(considered, lore.ConsideredEntry{Slug: entry.Slug, Score: 0, Retrieved: false, Reason: outcome})
			continue
		}
		result := svc.scorer.Score(profile, &entry, ScoreInput{
			FTSScore:         ftsScores[i],
			ActiveSubjects:   req.ActiveSubjects,
			ExcludedSubjects: req.ExcludedSubjects,
			TagBoosts:        cfg.TagBoosts,
			RecencyWeighting: cfg.RecencyWeighting,
		})
		if result.Excluded {
			skipped = append(skipped, lore.SkippedEntry{Slug: entry.Slug, Reason: lore.OutcomeExcludedSubject})
			considered = append(considered, lore.ConsideredEntry{Slug: entry.Slug, Score: result.Score, Retrieved: false, Reason: lore.OutcomeExcludedSubject})
			continue
		}
		if result.Score < cfg.MinScore {
			skipped = append(skipped, lore.SkippedEntry{Slug: entry.Slug, Reason: lore.OutcomeBelowThreshold})
			considered = append(considered, lore.ConsideredEntry{Slug: entry.Slug, Score: result.Score, Retrieved: false, Reason: lore.OutcomeBelowThreshold})
			continue
		}
		scored = append(scored, scoredEntry{entry: entry, score: result.Score, reason: result.Reason})
	}

	sort.SliceStable(scored, func(i, j int) bool { return scored[i].score > scored[j].score })

	budget := req.TokenBudget
	if budget <= 0 {
		budget = cfg.TokenBudget
	}
	packet := svc.assemble(req, scored, constants, skipped, &considered, budget)
	packet.ScoringProfile = string(cfg.Strategy)

	trace := svc.buildTrace(req, cfg, considered, packet)
	if err := svc.store.InsertTrace(ctx, req.CampaignID, trace); err != nil {
		return nil, err
	}
	packet.RetrievalTraceID = trace.ID
	return packet, nil
}

type scoredEntry struct {
	entry  lore.Entry
	score  float64
	reason string
}

// assemble applies the token budget: constants first, then scored entries in
// descending order, recording over-budget skips and the included set.
func (svc *Service) assemble(req lore.RecallRequest, scored []scoredEntry, constants []lore.Entry, skipped []lore.SkippedEntry, considered *[]lore.ConsideredEntry, budget int) *lore.RecallPacket {
	packet := &lore.RecallPacket{
		PacketID:    svc.newID("recall"),
		Entries:     []lore.PacketEntry{},
		Skipped:     skipped,
		TokenBudget: budget,
	}
	tokensUsed := 0
	included := map[string]struct{}{}

	add := func(e lore.Entry, score float64, reason string) bool {
		if _, dup := included[e.Slug]; dup {
			return true
		}
		cost := svc.tokenCost(e)
		if budget > 0 && tokensUsed+cost > budget {
			packet.Skipped = append(packet.Skipped, lore.SkippedEntry{Slug: e.Slug, Reason: lore.OutcomeOverBudget})
			*considered = append(*considered, lore.ConsideredEntry{Slug: e.Slug, Score: score, Retrieved: false, Reason: lore.OutcomeOverBudget})
			return false
		}
		tokensUsed += cost
		included[e.Slug] = struct{}{}
		packet.Entries = append(packet.Entries, toPacketEntry(e, score, reason))
		*considered = append(*considered, lore.ConsideredEntry{Slug: e.Slug, Score: score, Retrieved: true, Reason: lore.OutcomeIncluded})
		return true
	}

	for _, c := range constants {
		add(c, 0, "constant entry")
	}
	for _, s := range scored {
		add(s.entry, s.score, s.reason)
	}
	packet.TokensUsed = tokensUsed
	return packet
}

func (svc *Service) buildTrace(req lore.RecallRequest, cfg lore.RetrievalConfig, considered []lore.ConsideredEntry, packet *lore.RecallPacket) *lore.RetrievalTrace {
	includedSlugs := make([]string, 0, len(packet.Entries))
	for _, e := range packet.Entries {
		includedSlugs = append(includedSlugs, e.Slug)
	}
	return &lore.RetrievalTrace{
		ID:                svc.newID("trace"),
		TurnID:            0,
		RPSessionID:       "",
		Timestamp:         svc.now().UTC().Format(time.RFC3339),
		Queries:           []string{req.Query},
		EntriesConsidered: considered,
		SceneBrief: lore.SceneBrief{
			EntriesIncluded: includedSlugs,
			TokenBudget:     packet.TokenBudget,
			TokensUsed:      packet.TokensUsed,
		},
		ConfigSnapshot: lore.TraceConfigSnapshot{
			Strategy:         cfg.Strategy,
			RetrievalDepth:   cfg.RetrievalDepth,
			MinScore:         cfg.MinScore,
			CanonFilter:      cfg.CanonFilter,
			TagBoosts:        cfg.TagBoosts,
			RecencyWeighting: cfg.RecencyWeighting,
		},
	}
}

func (svc *Service) tokenCost(e lore.Entry) int {
	chars := len(e.Summary) + len(e.BodyMD)
	cost := chars / svc.defaults.CharsPerToken
	if cost < 1 {
		cost = 1
	}
	return cost
}

// effectiveConfig resolves the campaign config (or service defaults) and applies
// any per-request overrides.
func (svc *Service) effectiveConfig(ctx context.Context, req lore.RecallRequest) lore.RetrievalConfig {
	cfg := lore.RetrievalConfig{
		CampaignID:     req.CampaignID,
		Strategy:       lore.StrategyNarrativeDefault,
		RetrievalDepth: lore.DepthStandard,
		MinScore:       svc.defaults.MinScore,
		TokenBudget:    svc.defaults.TokenBudget,
	}
	if stored, err := svc.store.GetConfig(ctx, req.CampaignID); err == nil && stored != nil {
		cfg = *stored
		if cfg.RetrievalDepth == "" {
			cfg.RetrievalDepth = lore.DepthStandard
		}
		if cfg.TokenBudget <= 0 {
			cfg.TokenBudget = svc.defaults.TokenBudget
		}
		if cfg.Strategy == "" {
			cfg.Strategy = lore.StrategyNarrativeDefault
		}
	}
	if o := req.ConfigOverrides; o != nil {
		if o.Strategy != "" {
			cfg.Strategy = o.Strategy
		}
		if o.RetrievalDepth != "" {
			cfg.RetrievalDepth = o.RetrievalDepth
		}
		if o.MinScore != nil {
			cfg.MinScore = *o.MinScore
		}
		if len(o.CanonFilter) > 0 {
			cfg.CanonFilter = o.CanonFilter
		}
		if o.TagBoosts != nil {
			cfg.TagBoosts = o.TagBoosts
		}
		if o.RecencyWeighting != nil {
			cfg.RecencyWeighting = *o.RecencyWeighting
		}
	}
	return cfg
}

func toPacketEntry(e lore.Entry, score float64, reason string) lore.PacketEntry {
	return lore.PacketEntry{
		Slug:        e.Slug,
		Title:       e.Title,
		Summary:     e.Summary,
		BodyMD:      e.BodyMD,
		Score:       score,
		CanonLevel:  e.CanonLevel,
		EntryKind:   e.EntryKind,
		SubjectRefs: e.SubjectRefs,
		Tags:        e.Tags,
		MatchReason: reason,
	}
}

func canonSet(levels []lore.CanonLevel) map[lore.CanonLevel]struct{} {
	if len(levels) == 0 {
		return nil
	}
	set := make(map[lore.CanonLevel]struct{}, len(levels))
	for _, l := range levels {
		set[l] = struct{}{}
	}
	return set
}

func filterCanon(entry lore.Entry, allowed map[lore.CanonLevel]struct{}) (lore.RetrievalOutcome, bool) {
	if allowed == nil {
		return "", true
	}
	if _, ok := allowed[entry.CanonLevel]; ok {
		return "", true
	}
	return lore.OutcomeCanonFiltered, false
}

// normalizeFTS maps the candidate set's bm25 ranks (more negative = better) to
// [0,1], best = 1. A recency listing (all ranks equal) yields 1 for every entry.
func normalizeFTS(candidates []store.EntryMatch) []float64 {
	scores := make([]float64, len(candidates))
	if len(candidates) == 0 {
		return scores
	}
	best, worst := candidates[0].FTSRank, candidates[0].FTSRank
	for _, c := range candidates {
		if c.FTSRank < best {
			best = c.FTSRank
		}
		if c.FTSRank > worst {
			worst = c.FTSRank
		}
	}
	span := worst - best
	for i, c := range candidates {
		if span == 0 {
			scores[i] = 1.0
			continue
		}
		scores[i] = (worst - c.FTSRank) / span
	}
	return scores
}
