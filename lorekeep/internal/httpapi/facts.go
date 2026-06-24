package httpapi

import (
	"net/http"
	"strconv"

	"github.com/FuzzySlipper/rusty-roleplay/lorekeep/internal/lore"
)

func (s *Server) handleCaptureFact(w http.ResponseWriter, r *http.Request) {
	var capture lore.FactCapture
	if err := decodeJSON(r, &capture); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}
	if capture.CanonLevel == "" {
		capture.CanonLevel = lore.CanonSessionCanon
	}
	if err := capture.Validate(); err != nil {
		writeServiceError(w, err)
		return
	}
	entry := captureToEntry(capture)
	id, err := s.store.CreateEntry(r.Context(), &entry)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	entry.ID = id
	writeJSON(w, http.StatusCreated, entry)
}

func (s *Server) handlePromoteFact(w http.ResponseWriter, r *http.Request) {
	var promo lore.FactPromotion
	if err := decodeJSON(r, &promo); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}
	promo.Slug = r.PathValue("slug")
	switch {
	case promo.ProfileID == "" || promo.CampaignID == "":
		writeError(w, http.StatusBadRequest, "profile_id and campaign_id are required")
		return
	case promo.ToCanonLevel != lore.CanonCanon && promo.ToCanonLevel != lore.CanonSessionCanon:
		writeError(w, http.StatusBadRequest, "to_canon_level must be canon or session_canon")
		return
	case !promo.PromotedBy.IsValid():
		writeError(w, http.StatusBadRequest, "invalid promoted_by")
		return
	}
	if err := s.store.PromoteFact(r.Context(), promo.ProfileID, promo.CampaignID, promo.Slug, promo.ToCanonLevel, promo.PromotedBy); err != nil {
		writeServiceError(w, err)
		return
	}
	entry, err := s.store.GetEntry(r.Context(), promo.ProfileID, promo.CampaignID, promo.Slug)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, entry)
}

func (s *Server) handleListFacts(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	profileID := q.Get("profile_id")
	campaignID := q.Get("campaign_id")
	if profileID == "" || campaignID == "" {
		writeError(w, http.StatusBadRequest, "profile_id and campaign_id query params are required")
		return
	}
	limit, _ := strconv.Atoi(q.Get("limit"))
	facts, err := s.store.ListEstablishedFacts(r.Context(), profileID, campaignID, limit)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	if facts == nil {
		facts = []lore.Entry{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"facts": facts})
}

func captureToEntry(c lore.FactCapture) lore.Entry {
	session := c.EstablishedInSession
	turn := c.EstablishedInTurn
	by := c.CapturedBy
	reason := c.CaptureReason
	return lore.Entry{
		ProfileID:            c.ProfileID,
		CampaignID:           c.CampaignID,
		Slug:                 c.Slug,
		Title:                c.Title,
		Summary:              c.Summary,
		BodyMD:               c.BodyMD,
		ContentFormat:        "markdown",
		EntryKind:            lore.EntryEstablishedFact,
		SubjectKind:          lore.SubjectEvent,
		SubjectRefs:          orEmpty(c.SubjectRefs),
		CanonLevel:           c.CanonLevel,
		Tags:                 orEmpty(c.Tags),
		Constant:             false,
		DiscoveryScope:       lore.ScopeCampaign,
		EstablishedInSession: &session,
		EstablishedInTurn:    &turn,
		CapturedBy:           &by,
		CaptureReason:        &reason,
		Status:               lore.StatusActive,
		Version:              1,
		CreatedBy:            string(c.CapturedBy),
		UpdatedBy:            string(c.CapturedBy),
	}
}

func orEmpty(v []string) []string {
	if v == nil {
		return []string{}
	}
	return v
}
