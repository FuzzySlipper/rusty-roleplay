package httpapi

import (
	"net/http"

	"github.com/FuzzySlipper/rusty-roleplay/lorekeep/internal/lore"
)

func (s *Server) handleCreateCampaign(w http.ResponseWriter, r *http.Request) {
	var campaign lore.Campaign
	if err := decodeJSON(r, &campaign); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}
	switch {
	case !lore.ValidSlug(campaign.ID):
		writeError(w, http.StatusBadRequest, "id must be a slug matching ^[a-z0-9]+(-[a-z0-9]+)*$")
		return
	case campaign.ProfileID == "":
		writeError(w, http.StatusBadRequest, "profile_id is required")
		return
	case campaign.Name == "":
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	if err := s.store.CreateCampaign(r.Context(), &campaign); err != nil {
		writeServiceError(w, err)
		return
	}
	created, err := s.store.GetCampaign(r.Context(), campaign.ID)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

func (s *Server) handleListCampaigns(w http.ResponseWriter, r *http.Request) {
	profileID := r.URL.Query().Get("profile_id")
	if profileID == "" {
		writeError(w, http.StatusBadRequest, "profile_id query param is required")
		return
	}
	campaigns, err := s.store.ListCampaigns(r.Context(), profileID)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	if campaigns == nil {
		campaigns = []lore.Campaign{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"campaigns": campaigns})
}

func (s *Server) handleGetCampaign(w http.ResponseWriter, r *http.Request) {
	campaign, err := s.store.GetCampaign(r.Context(), r.PathValue("id"))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, campaign)
}
