package httpapi

import (
	"net/http"
	"strconv"

	"github.com/FuzzySlipper/rusty-roleplay/lorekeep/internal/lore"
)

func (s *Server) handleTracesBySession(w http.ResponseWriter, r *http.Request) {
	sessionID := r.PathValue("session_id")
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	traces, err := s.store.TracesBySession(r.Context(), sessionID, limit)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	if traces == nil {
		traces = []lore.RetrievalTrace{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"traces": traces})
}

func (s *Server) handleGetTrace(w http.ResponseWriter, r *http.Request) {
	trace, err := s.store.GetTrace(r.Context(), r.PathValue("trace_id"))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, trace)
}
