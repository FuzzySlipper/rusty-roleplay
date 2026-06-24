// Package httpapi exposes lorekeep's HTTP surface. Handlers validate input,
// call the store/recall layers, and shape responses; no business logic lives here.
package httpapi

import (
	"net/http"
	"time"

	"github.com/FuzzySlipper/rusty-roleplay/lorekeep/internal/recall"
	"github.com/FuzzySlipper/rusty-roleplay/lorekeep/internal/store"
)

// Version is the build/version metadata served at GET /api/version.
type Version struct {
	Service         string `json:"service"`
	Version         string `json:"version"`
	ContractVersion string `json:"contract_version"`
	Commit          string `json:"commit,omitempty"`
	BuiltAt         string `json:"built_at,omitempty"`
}

// Server wires the storage and recall layers to HTTP routes.
type Server struct {
	store   *store.Store
	recall  *recall.Service
	version Version
	now     func() time.Time
	newID   func(prefix string) string
}

// NewServer constructs the HTTP server.
func NewServer(s *store.Store, r *recall.Service, version Version, now func() time.Time, newID func(string) string) *Server {
	return &Server{store: s, recall: r, version: version, now: now, newID: newID}
}

// Handler returns the configured HTTP router.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("POST /api/recall", s.handleRecall)
	mux.HandleFunc("POST /api/entries/search", s.handleSearch)
	mux.HandleFunc("POST /api/entries", s.handleCreateEntry)
	mux.HandleFunc("GET /api/entries/{slug}", s.handleGetEntry)
	mux.HandleFunc("PUT /api/entries/{slug}", s.handleUpdateEntry)
	mux.HandleFunc("GET /api/facts", s.handleListFacts)
	mux.HandleFunc("POST /api/facts/capture", s.handleCaptureFact)
	mux.HandleFunc("POST /api/facts/{slug}/promote", s.handlePromoteFact)
	mux.HandleFunc("GET /api/traces/by-session/{session_id}", s.handleTracesBySession)
	mux.HandleFunc("GET /api/traces/{trace_id}", s.handleGetTrace)
	mux.HandleFunc("GET /api/config/{campaign_id}", s.handleGetConfig)
	mux.HandleFunc("PUT /api/config/{campaign_id}", s.handlePutConfig)
	mux.HandleFunc("POST /api/campaigns", s.handleCreateCampaign)
	mux.HandleFunc("GET /api/campaigns", s.handleListCampaigns)
	mux.HandleFunc("GET /api/campaigns/{id}", s.handleGetCampaign)

	// Deployable-service contract: /health and /version at the root, not under /api.
	mux.HandleFunc("GET /health", s.handleHealth)
	mux.HandleFunc("GET /version", s.handleVersion)

	return mux
}
