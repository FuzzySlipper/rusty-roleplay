// Command lorekeep runs the lore/memory HTTP service: FTS5-backed,
// campaign-scoped RP lore storage, scored recall, traces, and config.
package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/FuzzySlipper/rusty-roleplay/lorekeep/internal/config"
	"github.com/FuzzySlipper/rusty-roleplay/lorekeep/internal/httpapi"
	"github.com/FuzzySlipper/rusty-roleplay/lorekeep/internal/lore"
	"github.com/FuzzySlipper/rusty-roleplay/lorekeep/internal/recall"
	"github.com/FuzzySlipper/rusty-roleplay/lorekeep/internal/store"
)

// version is the service version; commit is injected via -ldflags at release.
var (
	version = "0.1.0"
	commit  = ""
)

func main() {
	configPath := flag.String("config", os.Getenv("LOREKEEP_CONFIG"), "path to YAML config file")
	flag.Parse()

	if err := run(*configPath); err != nil {
		log.Fatalf("lorekeep: %v", err)
	}
}

func run(configPath string) error {
	cfg, err := config.Load(configPath)
	if err != nil {
		return err
	}

	db, err := store.Open(cfg.DBPath)
	if err != nil {
		return err
	}
	defer db.Close()
	applied, err := db.Migrate()
	if err != nil {
		return err
	}
	if len(applied) > 0 {
		log.Printf("applied migrations: %v", applied)
	}

	scorer, err := recall.LoadScorer(cfg.ContractRoot)
	if err != nil {
		return err
	}

	recallService := recall.NewService(db, scorer, recall.Defaults{
		TokenBudget:   cfg.Recall.DefaultTokenBudget,
		MinScore:      cfg.Recall.DefaultMinScore,
		CharsPerToken: cfg.Recall.CharsPerToken,
		DepthLimits: map[lore.RetrievalDepth]int{
			lore.DepthShallow:  cfg.Recall.ShallowLimit,
			lore.DepthStandard: cfg.Recall.StandardLimit,
			lore.DepthDeep:     cfg.Recall.DeepLimit,
		},
	}, time.Now, newID)

	server := httpapi.NewServer(db, recallService, httpapi.Version{
		Service:         "lorekeep",
		Version:         version,
		ContractVersion: "v0",
		Commit:          commit,
		BuiltAt:         time.Now().UTC().Format(time.RFC3339),
	}, time.Now, newID)

	httpServer := &http.Server{
		Addr:              cfg.ListenAddr,
		Handler:           server.Handler(),
		ReadHeaderTimeout: cfg.Timeouts.ReadHeader,
	}

	errCh := make(chan error, 1)
	go func() {
		log.Printf("lorekeep listening on http://%s", cfg.ListenAddr)
		errCh <- httpServer.ListenAndServe()
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	select {
	case sig := <-stop:
		log.Printf("received %s, shutting down", sig)
	case err := <-errCh:
		if err != nil && err != http.ErrServerClosed {
			return err
		}
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), cfg.Timeouts.Shutdown)
	defer cancel()
	return httpServer.Shutdown(ctx)
}

// newID returns a prefixed, time-ordered, collision-resistant identifier.
func newID(prefix string) string {
	var buf [6]byte
	_, _ = rand.Read(buf[:])
	return fmt.Sprintf("%s-%d-%s", prefix, time.Now().UnixNano(), hex.EncodeToString(buf[:]))
}
