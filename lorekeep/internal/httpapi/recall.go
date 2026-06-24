package httpapi

import (
	"net/http"

	"github.com/FuzzySlipper/rusty-roleplay/lorekeep/internal/lore"
)

func (s *Server) handleRecall(w http.ResponseWriter, r *http.Request) {
	var req lore.RecallRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}
	switch {
	case req.ProfileID == "":
		writeError(w, http.StatusBadRequest, "profile_id is required")
		return
	case req.CampaignID == "":
		writeError(w, http.StatusBadRequest, "campaign_id is required")
		return
	case req.Query == "":
		writeError(w, http.StatusBadRequest, "query is required")
		return
	}
	packet, err := s.recall.Recall(r.Context(), req)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, packet)
}
