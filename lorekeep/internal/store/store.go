// Package store owns lorekeep's SQLite storage, including FTS5 search and the
// embedded schema migrations. All SQL lives in this package.
package store

import (
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	_ "modernc.org/sqlite"
)

// ErrNotFound is returned when a requested row does not exist.
var ErrNotFound = errors.New("not found")

// Store owns the SQLite database handle.
type Store struct {
	db *sql.DB
}

// Open opens (creating parent directories as needed) a SQLite database and
// configures the pragmas lorekeep relies on.
func Open(path string) (*Store, error) {
	if path == "" {
		return nil, errors.New("store: database path is required")
	}
	if path != ":memory:" {
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			return nil, fmt.Errorf("create database directory: %w", err)
		}
	}
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	// modernc SQLite is single-writer; cap connections so WAL writes serialize.
	db.SetMaxOpenConns(1)
	s := &Store{db: db}
	for _, pragma := range []string{
		"PRAGMA foreign_keys = ON",
		"PRAGMA busy_timeout = 5000",
		"PRAGMA journal_mode = WAL",
	} {
		if _, err := db.Exec(pragma); err != nil {
			db.Close()
			return nil, fmt.Errorf("apply %s: %w", pragma, err)
		}
	}
	return s, nil
}

// Close closes the database handle.
func (s *Store) Close() error {
	return s.db.Close()
}

// Migrate applies embedded SQL migrations in lexical order and returns the
// versions newly applied.
func (s *Store) Migrate() ([]string, error) {
	if _, err := s.db.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))`); err != nil {
		return nil, fmt.Errorf("ensure schema_migrations: %w", err)
	}
	known, err := s.knownMigrations()
	if err != nil {
		return nil, err
	}
	names, err := migrationNames()
	if err != nil {
		return nil, fmt.Errorf("read migrations: %w", err)
	}
	sort.Strings(names)
	applied := []string{}
	for _, name := range names {
		version := strings.TrimSuffix(name, ".sql")
		if _, ok := known[version]; ok {
			continue
		}
		body, err := migrationSQL(name)
		if err != nil {
			return nil, fmt.Errorf("read migration %s: %w", name, err)
		}
		if _, err := s.db.Exec(body); err != nil {
			return nil, fmt.Errorf("apply migration %s: %w", name, err)
		}
		if _, err := s.db.Exec(`INSERT INTO schema_migrations (version) VALUES (?)`, version); err != nil {
			return nil, fmt.Errorf("record migration %s: %w", name, err)
		}
		applied = append(applied, version)
	}
	return applied, nil
}

func (s *Store) knownMigrations() (map[string]struct{}, error) {
	rows, err := s.db.Query(`SELECT version FROM schema_migrations`)
	if err != nil {
		return nil, fmt.Errorf("read schema_migrations: %w", err)
	}
	defer rows.Close()
	known := map[string]struct{}{}
	for rows.Next() {
		var version string
		if err := rows.Scan(&version); err != nil {
			return nil, fmt.Errorf("scan schema version: %w", err)
		}
		known[version] = struct{}{}
	}
	return known, rows.Err()
}

// Ping verifies the database is reachable.
func (s *Store) Ping() error {
	return s.db.Ping()
}
