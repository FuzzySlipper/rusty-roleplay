package httpapi

import (
	"net/http"

	"github.com/FuzzySlipper/rusty-roleplay/lorekeep/internal/lore"
)

func (s *Server) handleGetConfig(w http.ResponseWriter, r *http.Request) {
	cfg, err := s.store.GetConfig(r.Context(), r.PathValue("campaign_id"))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, cfg)
}

func (s *Server) handlePutConfig(w http.ResponseWriter, r *http.Request) {
	var cfg lore.RetrievalConfig
	if err := decodeJSON(r, &cfg); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}
	cfg.CampaignID = r.PathValue("campaign_id")
	if cfg.RetrievalDepth != "" && !cfg.RetrievalDepth.IsValid() {
		writeError(w, http.StatusBadRequest, "invalid retrieval_depth")
		return
	}
	if err := s.store.PutConfig(r.Context(), &cfg); err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, cfg)
}
