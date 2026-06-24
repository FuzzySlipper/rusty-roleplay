// Package lore holds lorekeep's domain types and closed vocabularies. The enum
// values mirror contracts/v0/registry.json; the contract is the source of truth
// and the validation command (cmd/lorekeep-validate) guards drift.
package lore

// EntryKind classifies an entry as authored content or a captured fact.
type EntryKind string

const (
	EntryAuthoredLore    EntryKind = "authored_lore"
	EntryEstablishedFact EntryKind = "established_fact"
)

func (k EntryKind) IsValid() bool {
	switch k {
	case EntryAuthoredLore, EntryEstablishedFact:
		return true
	}
	return false
}

// SubjectKind classifies what a lore entry is about.
type SubjectKind string

const (
	SubjectWorldRule    SubjectKind = "world_rule"
	SubjectCharacter    SubjectKind = "character"
	SubjectLocation     SubjectKind = "location"
	SubjectFaction      SubjectKind = "faction"
	SubjectItem         SubjectKind = "item"
	SubjectEvent        SubjectKind = "event"
	SubjectRelationship SubjectKind = "relationship"
)

func (k SubjectKind) IsValid() bool {
	switch k {
	case SubjectWorldRule, SubjectCharacter, SubjectLocation, SubjectFaction,
		SubjectItem, SubjectEvent, SubjectRelationship:
		return true
	}
	return false
}

// NodeKind classifies a topic-graph node.
type NodeKind string

const (
	NodeCharacter NodeKind = "character"
	NodeLocation  NodeKind = "location"
	NodeFaction   NodeKind = "faction"
	NodeItem      NodeKind = "item"
	NodeEvent     NodeKind = "event"
	NodeConcept   NodeKind = "concept"
)

func (k NodeKind) IsValid() bool {
	switch k {
	case NodeCharacter, NodeLocation, NodeFaction, NodeItem, NodeEvent, NodeConcept:
		return true
	}
	return false
}

// CanonLevel is the authority level of a lore entry.
type CanonLevel string

const (
	CanonCanon        CanonLevel = "canon"
	CanonSessionCanon CanonLevel = "session_canon"
	CanonRumor        CanonLevel = "rumor"
	CanonDeprecated   CanonLevel = "deprecated"
	CanonAmbiguous    CanonLevel = "ambiguous"
)

func (c CanonLevel) IsValid() bool {
	switch c {
	case CanonCanon, CanonSessionCanon, CanonRumor, CanonDeprecated, CanonAmbiguous:
		return true
	}
	return false
}

// CampaignScope is the discovery scope for entries and nodes.
type CampaignScope string

const (
	ScopeCampaign     CampaignScope = "campaign"
	ScopeCharacter    CampaignScope = "character"
	ScopeLocation     CampaignScope = "location"
	ScopeFaction      CampaignScope = "faction"
	ScopeExplicitOnly CampaignScope = "explicit_only"
)

func (s CampaignScope) IsValid() bool {
	switch s {
	case ScopeCampaign, ScopeCharacter, ScopeLocation, ScopeFaction, ScopeExplicitOnly:
		return true
	}
	return false
}

// EntryStatus is the lifecycle state of an entry.
type EntryStatus string

const (
	StatusActive     EntryStatus = "active"
	StatusSuperseded EntryStatus = "superseded"
	StatusDeprecated EntryStatus = "deprecated"
	StatusArchived   EntryStatus = "archived"
)

func (s EntryStatus) IsValid() bool {
	switch s {
	case StatusActive, StatusSuperseded, StatusDeprecated, StatusArchived:
		return true
	}
	return false
}

// CapturedBy is the actor that captured a fact.
type CapturedBy string

const (
	CapturedByRPAgent       CapturedBy = "rp_agent"
	CapturedByMechanicAgent CapturedBy = "mechanic_agent"
	CapturedByUser          CapturedBy = "user"
)

func (a CapturedBy) IsValid() bool {
	switch a {
	case CapturedByRPAgent, CapturedByMechanicAgent, CapturedByUser:
		return true
	}
	return false
}

// CaptureReason is why a fact was captured.
type CaptureReason string

const (
	ReasonPlotEvent            CaptureReason = "plot_event"
	ReasonRelationshipChange   CaptureReason = "relationship_change"
	ReasonRevealedInformation  CaptureReason = "revealed_information"
	ReasonCharacterDevelopment CaptureReason = "character_development"
	ReasonUserOverride         CaptureReason = "user_override"
)

func (r CaptureReason) IsValid() bool {
	switch r {
	case ReasonPlotEvent, ReasonRelationshipChange, ReasonRevealedInformation,
		ReasonCharacterDevelopment, ReasonUserOverride:
		return true
	}
	return false
}

// RetrievalStrategy names a scoring profile.
type RetrievalStrategy string

const (
	StrategyNarrativeDefault RetrievalStrategy = "narrative_default"
	StrategyLoreHeavy        RetrievalStrategy = "lore_heavy"
	StrategyCharacterFocused RetrievalStrategy = "character_focused"
)

func (s RetrievalStrategy) IsValid() bool {
	switch s {
	case StrategyNarrativeDefault, StrategyLoreHeavy, StrategyCharacterFocused:
		return true
	}
	return false
}

// RetrievalDepth controls how many candidates are considered per query.
type RetrievalDepth string

const (
	DepthShallow  RetrievalDepth = "shallow"
	DepthStandard RetrievalDepth = "standard"
	DepthDeep     RetrievalDepth = "deep"
)

func (d RetrievalDepth) IsValid() bool {
	switch d {
	case DepthShallow, DepthStandard, DepthDeep:
		return true
	}
	return false
}

// RetrievalOutcome is why an entry was or was not retrieved.
type RetrievalOutcome string

const (
	OutcomeIncluded        RetrievalOutcome = "included"
	OutcomeBelowThreshold  RetrievalOutcome = "below_threshold"
	OutcomeExcludedSubject RetrievalOutcome = "excluded_subject"
	OutcomeCanonFiltered   RetrievalOutcome = "canon_filtered"
	OutcomeScopeFiltered   RetrievalOutcome = "scope_filtered"
	OutcomeOverBudget      RetrievalOutcome = "over_budget"
)

// EdgeRelation is a typed topic-graph edge relation.
type EdgeRelation string

const (
	RelationMemberOf   EdgeRelation = "member_of"
	RelationLocatedIn  EdgeRelation = "located_in"
	RelationRivalOf    EdgeRelation = "rival_of"
	RelationOwns       EdgeRelation = "owns"
	RelationKnowsAbout EdgeRelation = "knows_about"
	RelationControls   EdgeRelation = "controls"
	RelationParentOf   EdgeRelation = "parent_of"
	RelationRelatedTo  EdgeRelation = "related_to"
)

func (r EdgeRelation) IsValid() bool {
	switch r {
	case RelationMemberOf, RelationLocatedIn, RelationRivalOf, RelationOwns,
		RelationKnowsAbout, RelationControls, RelationParentOf, RelationRelatedTo:
		return true
	}
	return false
}
