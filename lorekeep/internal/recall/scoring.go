// Package recall implements lorekeep's scoring, budgeting, and packet assembly.
package recall

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"strings"

	"github.com/FuzzySlipper/rusty-roleplay/lorekeep/internal/lore"
)

// Scorer holds the named scoring profiles and shared modifier tables loaded
// from contracts/v0/scoring-defaults.json.
type Scorer struct {
	defaultProfile string
	profiles       map[string]map[string]float64
	canonScores    map[string]float64
}

// scoringFile mirrors the parts of scoring-defaults.json the scorer needs.
type scoringFile struct {
	DefaultProfile string `json:"default_profile"`
	Profiles       map[string]struct {
		Weights map[string]float64 `json:"weights"`
	} `json:"profiles"`
	CanonLevelScores map[string]float64 `json:"canon_level_scores"`
}

// LoadScorer reads scoring-defaults.json from the contract root.
func LoadScorer(contractRoot string) (*Scorer, error) {
	path := filepath.Join(contractRoot, "contracts", "v0", "scoring-defaults.json")
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read scoring defaults: %w", err)
	}
	var file scoringFile
	if err := json.Unmarshal(data, &file); err != nil {
		return nil, fmt.Errorf("decode scoring defaults: %w", err)
	}
	if len(file.Profiles) == 0 {
		return nil, fmt.Errorf("scoring defaults has no profiles")
	}
	profiles := map[string]map[string]float64{}
	for name, p := range file.Profiles {
		profiles[name] = p.Weights
	}
	if _, ok := profiles[file.DefaultProfile]; !ok {
		return nil, fmt.Errorf("default profile %q not defined", file.DefaultProfile)
	}
	return &Scorer{
		defaultProfile: file.DefaultProfile,
		profiles:       profiles,
		canonScores:    file.CanonLevelScores,
	}, nil
}

// profileName maps a strategy enum (underscored) to a profile key (hyphenated),
// falling back to the default profile when the strategy is empty or unknown.
func (sc *Scorer) profileName(strategy lore.RetrievalStrategy) string {
	if strategy == "" {
		return sc.defaultProfile
	}
	name := strings.ReplaceAll(string(strategy), "_", "-")
	if _, ok := sc.profiles[name]; ok {
		return name
	}
	return sc.defaultProfile
}

// ScoreInput carries the per-entry signals the scorer combines.
type ScoreInput struct {
	FTSScore         float64
	ActiveSubjects   []string
	ExcludedSubjects []string
	TagBoosts        map[string]float64
	RecencyWeighting float64
}

// ScoreResult is the outcome of scoring one entry.
type ScoreResult struct {
	Score    float64
	Excluded bool
	Reason   string
}

// Score combines the weighted factors for one entry under the named profile.
func (sc *Scorer) Score(profileName string, entry *lore.Entry, in ScoreInput) ScoreResult {
	w := sc.profiles[profileName]
	activeSet := toSet(in.ActiveSubjects)
	excludedSet := toSet(in.ExcludedSubjects)

	subjectMatch, subjectReasons := overlapScore(entry.SubjectRefs, activeSet)
	excluded, _ := overlap(entry.SubjectRefs, excludedSet)

	canonMod := sc.canonScores[string(entry.CanonLevel)]
	recencyMod := 0.0 // v0: recency signal is reserved; recency_weighting scales it once populated.
	scopeMatch := scopeMatchScore(entry, subjectMatch)
	tagBoost := tagBoostScore(entry.Tags, in.TagBoosts)
	tagMatch, _ := overlapScore(entry.Tags, activeSet)

	base := in.FTSScore*weight(w, "fts_score") +
		tagMatch*weight(w, "tag_match") +
		subjectMatch*weight(w, "subject_match") +
		canonMod*weight(w, "canon_level_modifier") +
		recencyMod*weight(w, "recency_modifier")*in.RecencyWeighting +
		scopeMatch*weight(w, "scope_match") +
		tagBoost*weight(w, "tag_boost")

	result := ScoreResult{Score: round(base)}
	if excluded {
		result.Score = round(base * weight(w, "excluded_subject_penalty"))
		result.Excluded = true
		result.Reason = "excluded_subject match"
		return result
	}
	result.Reason = matchReason(in.FTSScore, subjectReasons)
	return result
}

func weight(w map[string]float64, key string) float64 {
	return w[key]
}

func scopeMatchScore(entry *lore.Entry, subjectMatch float64) float64 {
	switch entry.DiscoveryScope {
	case lore.ScopeCampaign:
		return 1.0
	case lore.ScopeExplicitOnly:
		return 0.0
	default:
		// character/location/faction-scoped entries match only when a relevant
		// subject is active in the scene.
		if subjectMatch > 0 {
			return 1.0
		}
		return 0.3
	}
}

func tagBoostScore(tags []string, boosts map[string]float64) float64 {
	if len(boosts) == 0 {
		return 0
	}
	total := 0.0
	for _, tag := range tags {
		total += boosts[tag]
	}
	return total
}

func overlap(values []string, set map[string]struct{}) (bool, []string) {
	var hits []string
	for _, v := range values {
		if _, ok := set[v]; ok {
			hits = append(hits, v)
		}
	}
	return len(hits) > 0, hits
}

// overlapScore returns the fraction of the set covered by values, plus the hits.
func overlapScore(values []string, set map[string]struct{}) (float64, []string) {
	if len(set) == 0 {
		return 0, nil
	}
	_, hits := overlap(values, set)
	return float64(len(hits)) / float64(len(set)), hits
}

func toSet(values []string) map[string]struct{} {
	set := make(map[string]struct{}, len(values))
	for _, v := range values {
		set[v] = struct{}{}
	}
	return set
}

func matchReason(ftsScore float64, subjectHits []string) string {
	parts := []string{}
	if ftsScore > 0 {
		parts = append(parts, "fts match")
	}
	if len(subjectHits) > 0 {
		parts = append(parts, "subject: "+strings.Join(subjectHits, ", "))
	}
	if len(parts) == 0 {
		return "included"
	}
	return strings.Join(parts, "; ")
}

func round(v float64) float64 {
	return math.Round(v*1000) / 1000
}
