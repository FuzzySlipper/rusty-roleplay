package httpapi

import "net/http"

type healthCheck struct {
	Status string `json:"status"`
	Detail string `json:"detail,omitempty"`
}

type healthResponse struct {
	Status string                 `json:"status"`
	Checks map[string]healthCheck `json:"checks,omitempty"`
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	resp := healthResponse{Status: "ok", Checks: map[string]healthCheck{}}
	status := http.StatusOK
	if err := s.store.Ping(); err != nil {
		resp.Status = "unavailable"
		resp.Checks["database"] = healthCheck{Status: "unavailable", Detail: err.Error()}
		status = http.StatusServiceUnavailable
	} else {
		resp.Checks["database"] = healthCheck{Status: "ok"}
	}
	writeJSON(w, status, resp)
}

func (s *Server) handleVersion(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, s.version)
}
