package httpapi_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/FuzzySlipper/rusty-roleplay/lorekeep/internal/httpapi"
	"github.com/FuzzySlipper/rusty-roleplay/lorekeep/internal/lore"
	"github.com/FuzzySlipper/rusty-roleplay/lorekeep/internal/recall"
	"github.com/FuzzySlipper/rusty-roleplay/lorekeep/internal/store"
)

const (
	testProfile  = "sister-a"
	testCampaign = "eldoria"
)

func newTestServer(t *testing.T) *httptest.Server {
	t.Helper()
	db, err := store.Open(":memory:")
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	if _, err := db.Migrate(); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	// Contract root is the lorekeep module root, two levels up from this package.
	scorer, err := recall.LoadScorer("../..")
	if err != nil {
		t.Fatalf("load scorer: %v", err)
	}
	var counter int64
	idgen := func(prefix string) string {
		return fmt.Sprintf("%s-%d", prefix, atomic.AddInt64(&counter, 1))
	}
	recallService := recall.NewService(db, scorer, recall.Defaults{
		TokenBudget:   2000,
		MinScore:      0.0,
		CharsPerToken: 4,
	}, time.Now, idgen)
	server := httpapi.NewServer(db, recallService, httpapi.Version{
		Service: "lorekeep", Version: "test", ContractVersion: "v0",
	}, time.Now, idgen)
	ts := httptest.NewServer(server.Handler())
	t.Cleanup(ts.Close)
	return ts
}

func seedEntries(t *testing.T, base string) {
	t.Helper()
	entries := []lore.Entry{
		{
			ProfileID: testProfile, CampaignID: testCampaign, Slug: "magic-laws",
			Title: "Laws of Magic", Summary: "Core magic constraints.", BodyMD: "Magic requires sacrifice.",
			ContentFormat: "markdown", EntryKind: lore.EntryAuthoredLore, SubjectKind: lore.SubjectWorldRule,
			CanonLevel: lore.CanonCanon, Constant: true, DiscoveryScope: lore.ScopeCampaign, Status: lore.StatusActive,
			Tags: []string{"magic"}, SubjectRefs: []string{},
		},
		{
			ProfileID: testProfile, CampaignID: testCampaign, Slug: "xavier-arm",
			Title: "Xavier's Neural Interface", Summary: "Xavier has a neural interface augmentation.",
			BodyMD:        "Xavier's neural interface augmentation lets him jack into command center systems.",
			ContentFormat: "markdown", EntryKind: lore.EntryAuthoredLore, SubjectKind: lore.SubjectCharacter,
			CanonLevel: lore.CanonCanon, DiscoveryScope: lore.ScopeCharacter, Status: lore.StatusActive,
			Tags: []string{"augmentation"}, SubjectRefs: []string{"xavier"},
		},
		{
			ProfileID: testProfile, CampaignID: testCampaign, Slug: "caleb-arm",
			Title: "Caleb's Prosthetic", Summary: "Caleb has a neural interface augmentation prosthetic.",
			BodyMD:        "Caleb's neural interface augmentation prosthetic arm interfaces with command center systems.",
			ContentFormat: "markdown", EntryKind: lore.EntryAuthoredLore, SubjectKind: lore.SubjectCharacter,
			CanonLevel: lore.CanonCanon, DiscoveryScope: lore.ScopeCharacter, Status: lore.StatusActive,
			Tags: []string{"augmentation"}, SubjectRefs: []string{"caleb"},
		},
	}
	for _, e := range entries {
		entry := e
		mustJSON(t, http.MethodPost, base+"/api/entries", entry, http.StatusCreated, nil)
	}
}

func TestHealthAndVersion(t *testing.T) {
	ts := newTestServer(t)
	var health map[string]any
	mustJSON(t, http.MethodGet, ts.URL+"/health", nil, http.StatusOK, &health)
	if health["status"] != "ok" {
		t.Fatalf("health status = %v, want ok", health["status"])
	}
	var version httpapi.Version
	mustJSON(t, http.MethodGet, ts.URL+"/version", nil, http.StatusOK, &version)
	if version.ContractVersion != "v0" {
		t.Fatalf("contract version = %q, want v0", version.ContractVersion)
	}
}

func TestEntryCRUDAndSearch(t *testing.T) {
	ts := newTestServer(t)
	seedEntries(t, ts.URL)

	var got lore.Entry
	mustJSON(t, http.MethodGet,
		ts.URL+"/api/entries/xavier-arm?profile_id="+testProfile+"&campaign_id="+testCampaign,
		nil, http.StatusOK, &got)
	if got.Version != 1 {
		t.Fatalf("initial version = %d, want 1", got.Version)
	}

	got.Summary = "Updated summary."
	var updated lore.Entry
	mustJSON(t, http.MethodPut, ts.URL+"/api/entries/xavier-arm", got, http.StatusOK, &updated)
	if updated.Version != 2 {
		t.Fatalf("updated version = %d, want 2", updated.Version)
	}

	var search struct {
		Entries []lore.Entry `json:"entries"`
	}
	body := searchBody{ProfileID: testProfile, CampaignID: testCampaign, Query: "neural interface"}
	mustJSON(t, http.MethodPost, ts.URL+"/api/entries/search", body, http.StatusOK, &search)
	if len(search.Entries) < 2 {
		t.Fatalf("search returned %d entries, want >= 2", len(search.Entries))
	}
}

func TestRecallScoresFiltersAndTraces(t *testing.T) {
	ts := newTestServer(t)
	seedEntries(t, ts.URL)

	req := lore.RecallRequest{
		ProfileID: testProfile, CampaignID: testCampaign,
		Query:          "neural interface augmentation command center",
		ActiveSubjects: []string{"xavier"}, ExcludedSubjects: []string{"caleb"},
		TokenBudget: 2000,
	}
	var packet lore.RecallPacket
	mustJSON(t, http.MethodPost, ts.URL+"/api/recall", req, http.StatusOK, &packet)

	if !containsSlug(packet.Entries, "xavier-arm") {
		t.Fatalf("expected xavier-arm in recall entries, got %+v", packet.Entries)
	}
	if !containsSlug(packet.Entries, "magic-laws") {
		t.Fatalf("expected constant magic-laws always included")
	}
	if containsSlug(packet.Entries, "caleb-arm") {
		t.Fatalf("caleb-arm should be excluded, not included")
	}
	if !skippedFor(packet.Skipped, "caleb-arm", lore.OutcomeExcludedSubject) {
		t.Fatalf("expected caleb-arm skipped as excluded_subject, got %+v", packet.Skipped)
	}
	if packet.RetrievalTraceID == "" {
		t.Fatalf("expected a retrieval_trace_id")
	}

	// The recall must have recorded a retrievable trace.
	var trace lore.RetrievalTrace
	mustJSON(t, http.MethodGet, ts.URL+"/api/traces/"+packet.RetrievalTraceID, nil, http.StatusOK, &trace)
	if len(trace.EntriesConsidered) == 0 {
		t.Fatalf("trace recorded no considered entries")
	}
}

func TestFactCaptureAndPromote(t *testing.T) {
	ts := newTestServer(t)
	capture := lore.FactCapture{
		ProfileID: testProfile, CampaignID: testCampaign, Slug: "stole-crown",
		Title: "Crown stolen", Summary: "The protagonist stole the crown.",
		BodyMD: "Turn 34 vault heist.", CanonLevel: lore.CanonSessionCanon,
		EstablishedInSession: "rp-1", EstablishedInTurn: 34,
		CapturedBy: lore.CapturedByRPAgent, CaptureReason: lore.ReasonPlotEvent,
	}
	var captured lore.Entry
	mustJSON(t, http.MethodPost, ts.URL+"/api/facts/capture", capture, http.StatusCreated, &captured)
	if captured.EntryKind != lore.EntryEstablishedFact {
		t.Fatalf("captured entry_kind = %q, want established_fact", captured.EntryKind)
	}

	promo := lore.FactPromotion{
		ProfileID: testProfile, CampaignID: testCampaign, Slug: "stole-crown",
		ToCanonLevel: lore.CanonCanon, PromotedBy: lore.CapturedByUser,
	}
	var promoted lore.Entry
	mustJSON(t, http.MethodPost, ts.URL+"/api/facts/stole-crown/promote", promo, http.StatusOK, &promoted)
	if promoted.CanonLevel != lore.CanonCanon {
		t.Fatalf("promoted canon_level = %q, want canon", promoted.CanonLevel)
	}
}

func TestCampaignCRUD(t *testing.T) {
	ts := newTestServer(t)
	campaign := lore.Campaign{
		ID: "eldoria", ProfileID: testProfile, Name: "The Eldoria Chronicles",
		Description: "A political fantasy campaign.",
	}
	var created lore.Campaign
	mustJSON(t, http.MethodPost, ts.URL+"/api/campaigns", campaign, http.StatusCreated, &created)
	if created.CreatedAt == "" {
		t.Fatalf("expected created_at to be populated")
	}

	var list struct {
		Campaigns []lore.Campaign `json:"campaigns"`
	}
	mustJSON(t, http.MethodGet, ts.URL+"/api/campaigns?profile_id="+testProfile, nil, http.StatusOK, &list)
	if len(list.Campaigns) != 1 || list.Campaigns[0].ID != "eldoria" {
		t.Fatalf("expected one campaign 'eldoria', got %+v", list.Campaigns)
	}

	var got lore.Campaign
	mustJSON(t, http.MethodGet, ts.URL+"/api/campaigns/eldoria", nil, http.StatusOK, &got)
	if got.Name != "The Eldoria Chronicles" {
		t.Fatalf("campaign name mismatch: %q", got.Name)
	}
}

func TestConfigRoundTrip(t *testing.T) {
	ts := newTestServer(t)
	cfg := lore.RetrievalConfig{
		RetrievalDepth: lore.DepthDeep, MinScore: 0.5, TokenBudget: 1500,
		CanonFilter: []lore.CanonLevel{lore.CanonCanon},
	}
	mustJSON(t, http.MethodPut, ts.URL+"/api/config/"+testCampaign, cfg, http.StatusOK, nil)

	var got lore.RetrievalConfig
	mustJSON(t, http.MethodGet, ts.URL+"/api/config/"+testCampaign, nil, http.StatusOK, &got)
	if got.RetrievalDepth != lore.DepthDeep || got.CampaignID != testCampaign {
		t.Fatalf("config round-trip mismatch: %+v", got)
	}
}

func TestRejectsUnknownEnum(t *testing.T) {
	ts := newTestServer(t)
	bad := map[string]any{
		"profile_id": testProfile, "campaign_id": testCampaign, "slug": "bad-entry",
		"title": "Bad", "summary": "s", "body_md": "b", "content_format": "markdown",
		"entry_kind": "authored_lore", "subject_kind": "character",
		"canon_level": "made_up_level", "discovery_scope": "campaign", "status": "active",
	}
	mustJSON(t, http.MethodPost, ts.URL+"/api/entries", bad, http.StatusBadRequest, nil)
}

type searchBody struct {
	ProfileID  string `json:"profile_id"`
	CampaignID string `json:"campaign_id"`
	Query      string `json:"query"`
}

func containsSlug(entries []lore.PacketEntry, slug string) bool {
	for _, e := range entries {
		if e.Slug == slug {
			return true
		}
	}
	return false
}

func skippedFor(skipped []lore.SkippedEntry, slug string, reason lore.RetrievalOutcome) bool {
	for _, s := range skipped {
		if s.Slug == slug && s.Reason == reason {
			return true
		}
	}
	return false
}

func mustJSON(t *testing.T, method, url string, body any, wantStatus int, out any) {
	t.Helper()
	var reader *bytes.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal request: %v", err)
		}
		reader = bytes.NewReader(data)
	} else {
		reader = bytes.NewReader(nil)
	}
	req, err := http.NewRequest(method, url, reader)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("%s %s: %v", method, url, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != wantStatus {
		t.Fatalf("%s %s: status = %d, want %d", method, url, resp.StatusCode, wantStatus)
	}
	if out != nil {
		if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
			t.Fatalf("decode response: %v", err)
		}
	}
}
