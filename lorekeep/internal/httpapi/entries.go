package httpapi

import (
	"net/http"

	"github.com/FuzzySlipper/rusty-roleplay/lorekeep/internal/lore"
)

func (s *Server) handleCreateEntry(w http.ResponseWriter, r *http.Request) {
	var entry lore.Entry
	if err := decodeJSON(r, &entry); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}
	applyEntryDefaults(&entry)
	if err := entry.Validate(); err != nil {
		writeServiceError(w, err)
		return
	}
	id, err := s.store.CreateEntry(r.Context(), &entry)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	entry.ID = id
	writeJSON(w, http.StatusCreated, entry)
}

func (s *Server) handleGetEntry(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	profileID := r.URL.Query().Get("profile_id")
	campaignID := r.URL.Query().Get("campaign_id")
	if profileID == "" || campaignID == "" {
		writeError(w, http.StatusBadRequest, "profile_id and campaign_id query params are required")
		return
	}
	entry, err := s.store.GetEntry(r.Context(), profileID, campaignID, slug)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, entry)
}

func (s *Server) handleUpdateEntry(w http.ResponseWriter, r *http.Request) {
	var entry lore.Entry
	if err := decodeJSON(r, &entry); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}
	entry.Slug = r.PathValue("slug")
	applyEntryDefaults(&entry)
	if err := entry.Validate(); err != nil {
		writeServiceError(w, err)
		return
	}
	if err := s.store.UpdateEntry(r.Context(), &entry); err != nil {
		writeServiceError(w, err)
		return
	}
	updated, err := s.store.GetEntry(r.Context(), entry.ProfileID, entry.CampaignID, entry.Slug)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

type searchRequest struct {
	ProfileID  string   `json:"profile_id"`
	CampaignID string   `json:"campaign_id"`
	Query      string   `json:"query"`
	Tags       []string `json:"tags,omitempty"`
	Limit      int      `json:"limit,omitempty"`
}

func (s *Server) handleSearch(w http.ResponseWriter, r *http.Request) {
	var req searchRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}
	if req.ProfileID == "" || req.CampaignID == "" {
		writeError(w, http.StatusBadRequest, "profile_id and campaign_id are required")
		return
	}
	entries, err := s.store.SearchEntries(r.Context(), req.ProfileID, req.CampaignID, req.Query, req.Tags, req.Limit)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	if entries == nil {
		entries = []lore.Entry{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"entries": entries})
}

// applyEntryDefaults fills the conventional defaults for a new/updated entry.
func applyEntryDefaults(e *lore.Entry) {
	if e.ContentFormat == "" {
		e.ContentFormat = "markdown"
	}
	if e.Status == "" {
		e.Status = lore.StatusActive
	}
	if e.DiscoveryScope == "" {
		e.DiscoveryScope = lore.ScopeCampaign
	}
	if e.Version < 1 {
		e.Version = 1
	}
	if e.SubjectRefs == nil {
		e.SubjectRefs = []string{}
	}
	if e.Tags == nil {
		e.Tags = []string{}
	}
}
