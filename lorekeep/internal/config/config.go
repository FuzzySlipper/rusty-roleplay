// Package config owns lorekeep's typed service configuration, loaded from YAML.
// Nothing that varies by deployment is hardcoded elsewhere.
package config

import (
	"fmt"
	"os"
	"time"

	"gopkg.in/yaml.v3"
)

// Config is the service-level configuration loaded from a YAML file.
type Config struct {
	ListenAddr   string        `yaml:"listen_addr"`
	DBPath       string        `yaml:"db_path"`
	ContractRoot string        `yaml:"contract_root"`
	Recall       RecallConfig  `yaml:"recall"`
	Timeouts     TimeoutConfig `yaml:"timeouts"`
}

// RecallConfig holds default recall tunables applied when a campaign has no
// stored config and a request supplies no overrides.
type RecallConfig struct {
	DefaultTokenBudget int     `yaml:"default_token_budget"`
	DefaultMinScore    float64 `yaml:"default_min_score"`
	CharsPerToken      int     `yaml:"chars_per_token"`
	ShallowLimit       int     `yaml:"shallow_limit"`
	StandardLimit      int     `yaml:"standard_limit"`
	DeepLimit          int     `yaml:"deep_limit"`
}

// TimeoutConfig holds HTTP server timeouts.
type TimeoutConfig struct {
	ReadHeader time.Duration `yaml:"read_header"`
	Shutdown   time.Duration `yaml:"shutdown"`
}

// Default returns a config with sensible development defaults. Load overlays a
// file on top of these.
func Default() Config {
	return Config{
		ListenAddr:   "127.0.0.1:8790",
		DBPath:       "./runtime/lorekeep.sqlite",
		ContractRoot: ".",
		Recall: RecallConfig{
			DefaultTokenBudget: 2000,
			DefaultMinScore:    0.0,
			CharsPerToken:      4,
			ShallowLimit:       10,
			StandardLimit:      25,
			DeepLimit:          60,
		},
		Timeouts: TimeoutConfig{
			ReadHeader: 5 * time.Second,
			Shutdown:   10 * time.Second,
		},
	}
}

// Load reads and validates a YAML config file, overlaying it on Default().
// An empty path returns Default().
func Load(path string) (Config, error) {
	cfg := Default()
	if path == "" {
		return cfg, nil
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return Config{}, fmt.Errorf("read config: %w", err)
	}
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return Config{}, fmt.Errorf("decode config: %w", err)
	}
	if err := cfg.validate(); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

func (c Config) validate() error {
	switch {
	case c.ListenAddr == "":
		return fmt.Errorf("config: listen_addr is required")
	case c.DBPath == "":
		return fmt.Errorf("config: db_path is required")
	case c.Recall.CharsPerToken <= 0:
		return fmt.Errorf("config: recall.chars_per_token must be positive")
	case c.Recall.DefaultTokenBudget <= 0:
		return fmt.Errorf("config: recall.default_token_budget must be positive")
	}
	return nil
}
