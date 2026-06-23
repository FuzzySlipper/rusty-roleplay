// Command lorekeep-validate reads all lorekeep v0 contract artifacts, validates
// example payloads against their JSON schemas, checks enum/registry references,
// asserts scoring invariants, and confirms the registry is a closed vocabulary.
// It exits 0 on success and 1 on the first failure.
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"

	"github.com/santhosh-tekuri/jsonschema/v6"
)

// requiredRegistryKeys must be present and non-empty in registry.json.
var requiredRegistryKeys = []string{
	"entry_kinds", "subject_kinds", "node_kinds", "canon_levels",
	"campaign_scopes", "entry_statuses", "content_formats", "captured_by_actors",
	"fact_capture_reasons", "retrieval_strategies", "retrieval_depths",
	"retrieval_outcomes", "edge_relations",
}

// registrySpotChecks asserts a known value exists in a given registry key, so a
// silent rename of a canonical value fails the build.
var registrySpotChecks = map[string]string{
	"entry_kinds":          "established_fact",
	"subject_kinds":        "relationship",
	"canon_levels":         "session_canon",
	"campaign_scopes":      "explicit_only",
	"fact_capture_reasons": "user_override",
	"retrieval_strategies": "character_focused",
	"edge_relations":       "knows_about",
}

// exampleSchemas maps each single-document example payload to its schema.
var exampleSchemas = map[string]string{
	"entry.example.json":            "entry.schema.json",
	"recall-request.example.json":   "recall-request.schema.json",
	"recall-packet.example.json":    "recall-packet.schema.json",
	"retrieval-trace.example.json":  "retrieval-trace.schema.json",
	"retrieval-config.example.json": "retrieval-config.schema.json",
	"fact-capture.example.json":     "fact-capture.schema.json",
	"fact-promotion.example.json":   "fact-promotion.schema.json",
	"campaign.example.json":         "campaign.schema.json",
	"health.example.json":           "health.schema.json",
	"version.example.json":          "version.schema.json",
}

// scoringFactors are the per-profile weights every scoring profile must define.
var scoringFactors = []string{
	"fts_score", "tag_match", "subject_match", "canon_level_modifier",
	"recency_modifier", "scope_match", "tag_boost", "excluded_subject_penalty",
}

func main() {
	root := "."
	if len(os.Args) > 1 {
		root = os.Args[1]
	}
	if err := run(root); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Println("lorekeep contract validation passed")
}

func run(root string) error {
	contract := filepath.Join(root, "contracts", "v0")
	examples := filepath.Join(contract, "examples")

	if err := validateRegistry(filepath.Join(contract, "registry.json")); err != nil {
		return err
	}
	if err := validateScoring(filepath.Join(contract, "scoring-defaults.json")); err != nil {
		return err
	}
	if err := validateTools(filepath.Join(contract, "tools.json")); err != nil {
		return err
	}

	compiler, err := loadSchemas(filepath.Join(contract, "schemas"))
	if err != nil {
		return err
	}
	if err := validateExamples(compiler, examples); err != nil {
		return err
	}
	if err := validateTopicGraph(compiler, filepath.Join(examples, "topic-graph.example.json")); err != nil {
		return err
	}
	return validateNegativeCases(compiler, examples)
}

func loadSchemas(schemasDir string) (*jsonschema.Compiler, error) {
	compiler := jsonschema.NewCompiler()
	entries, err := os.ReadDir(schemasDir)
	if err != nil {
		return nil, err
	}
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}
		var schema map[string]any
		if err := readJSON(filepath.Join(schemasDir, entry.Name()), &schema); err != nil {
			return nil, err
		}
		if id, ok := schema["$id"].(string); ok {
			if err := compiler.AddResource(id, schema); err != nil {
				return nil, fmt.Errorf("add schema %s: %w", id, err)
			}
		}
		if err := compiler.AddResource(entry.Name(), schema); err != nil {
			return nil, fmt.Errorf("add schema %s: %w", entry.Name(), err)
		}
	}
	return compiler, nil
}

func validateRegistry(path string) error {
	var raw map[string]any
	if err := readJSON(path, &raw); err != nil {
		return err
	}
	registry := map[string][]string{}
	for key, value := range raw {
		items, ok := value.([]any)
		if !ok {
			continue
		}
		registry[key] = stringsFromAny(items)
	}
	for _, key := range requiredRegistryKeys {
		values := registry[key]
		if len(values) == 0 {
			return fmt.Errorf("registry %s is empty", key)
		}
		seen := map[string]struct{}{}
		for _, value := range values {
			if _, ok := seen[value]; ok {
				return fmt.Errorf("registry %s has duplicate %q", key, value)
			}
			seen[value] = struct{}{}
		}
	}
	for key, value := range registrySpotChecks {
		if !contains(registry[key], value) {
			return fmt.Errorf("registry %s missing %s", key, value)
		}
	}
	return nil
}

func validateScoring(path string) error {
	var scoring map[string]any
	if err := readJSON(path, &scoring); err != nil {
		return err
	}
	defaultProfile, _ := scoring["default_profile"].(string)
	if defaultProfile == "" {
		return fmt.Errorf("scoring default_profile is missing")
	}
	profiles, ok := scoring["profiles"].(map[string]any)
	if !ok || len(profiles) == 0 {
		return fmt.Errorf("scoring profiles section is missing or empty")
	}
	if _, ok := profiles[defaultProfile]; !ok {
		return fmt.Errorf("scoring default_profile %q is not defined in profiles", defaultProfile)
	}
	for name := range profiles {
		weights := profileWeights(profiles, name)
		if weights == nil {
			return fmt.Errorf("scoring profile %q has no weights", name)
		}
		for _, factor := range scoringFactors {
			if _, ok := weights[factor]; !ok {
				return fmt.Errorf("scoring profile %q missing weight %s", name, factor)
			}
		}
		penalty, _ := weights["excluded_subject_penalty"].(float64)
		if penalty < 0 || penalty > 1 {
			return fmt.Errorf("scoring profile %q excluded_subject_penalty must be in [0,1]", name)
		}
	}
	// Profile intent: character-focused must weight subject matching above the
	// balanced default, and lore-heavy must not weight FTS below the default.
	if weight(profiles, "character-focused", "subject_match") <= weight(profiles, "narrative-default", "subject_match") {
		return fmt.Errorf("character-focused must weight subject_match above narrative-default")
	}
	if weight(profiles, "lore-heavy", "fts_score") < weight(profiles, "narrative-default", "fts_score") {
		return fmt.Errorf("lore-heavy must weight fts_score at least as high as narrative-default")
	}
	// Canon authority ordering: canon outranks rumor, rumor outranks deprecated.
	canonScores, _ := scoring["canon_level_scores"].(map[string]any)
	canon, _ := canonScores["canon"].(float64)
	rumor, _ := canonScores["rumor"].(float64)
	deprecated, _ := canonScores["deprecated"].(float64)
	if !(canon > rumor && rumor > deprecated) {
		return fmt.Errorf("canon_level_scores must satisfy canon > rumor > deprecated")
	}
	return nil
}

// validateTools checks tools.json is internally consistent: every tool named in
// a tool_set is defined in the tools list, every tool carries a name, behavior,
// and parameters object, and tool names are unique.
func validateTools(path string) error {
	var doc struct {
		ToolSets map[string]struct {
			Tools []string `json:"tools"`
		} `json:"tool_sets"`
		Tools []struct {
			Name       string         `json:"name"`
			Behavior   string         `json:"behavior"`
			Parameters map[string]any `json:"parameters"`
		} `json:"tools"`
	}
	if err := readJSON(path, &doc); err != nil {
		return err
	}
	if len(doc.ToolSets) == 0 {
		return fmt.Errorf("tools.json has no tool_sets")
	}
	if len(doc.Tools) == 0 {
		return fmt.Errorf("tools.json has no tools")
	}
	defined := map[string]struct{}{}
	for _, tool := range doc.Tools {
		if tool.Name == "" {
			return fmt.Errorf("tools.json has a tool with no name")
		}
		if _, ok := defined[tool.Name]; ok {
			return fmt.Errorf("tools.json has duplicate tool %q", tool.Name)
		}
		defined[tool.Name] = struct{}{}
		if tool.Behavior == "" {
			return fmt.Errorf("tools.json tool %q has no behavior", tool.Name)
		}
		if tool.Parameters == nil {
			return fmt.Errorf("tools.json tool %q has no parameters", tool.Name)
		}
	}
	for setName, set := range doc.ToolSets {
		if len(set.Tools) == 0 {
			return fmt.Errorf("tools.json tool_set %q is empty", setName)
		}
		for _, name := range set.Tools {
			if _, ok := defined[name]; !ok {
				return fmt.Errorf("tools.json tool_set %q references undefined tool %q", setName, name)
			}
		}
	}
	return nil
}

func validateExamples(compiler *jsonschema.Compiler, examples string) error {
	names := make([]string, 0, len(exampleSchemas))
	for name := range exampleSchemas {
		names = append(names, name)
	}
	sort.Strings(names)
	for _, exampleName := range names {
		schema, err := compiler.Compile(exampleSchemas[exampleName])
		if err != nil {
			return fmt.Errorf("compile %s: %w", exampleSchemas[exampleName], err)
		}
		var data any
		if err := readJSON(filepath.Join(examples, exampleName), &data); err != nil {
			return err
		}
		if err := schema.Validate(data); err != nil {
			return fmt.Errorf("%s: %w", exampleName, err)
		}
	}
	return nil
}

// validateTopicGraph validates the composite graph example by checking each node
// against the topic-node schema and each edge against the topic-edge schema.
func validateTopicGraph(compiler *jsonschema.Compiler, path string) error {
	nodeSchema, err := compiler.Compile("topic-node.schema.json")
	if err != nil {
		return err
	}
	edgeSchema, err := compiler.Compile("topic-edge.schema.json")
	if err != nil {
		return err
	}
	var graph struct {
		Nodes []any `json:"nodes"`
		Edges []any `json:"edges"`
	}
	if err := readJSON(path, &graph); err != nil {
		return err
	}
	if len(graph.Nodes) == 0 || len(graph.Edges) == 0 {
		return fmt.Errorf("topic-graph example must contain nodes and edges")
	}
	for i, node := range graph.Nodes {
		if err := nodeSchema.Validate(node); err != nil {
			return fmt.Errorf("topic-graph node %d: %w", i, err)
		}
	}
	for i, edge := range graph.Edges {
		if err := edgeSchema.Validate(edge); err != nil {
			return fmt.Errorf("topic-graph edge %d: %w", i, err)
		}
	}
	return nil
}

// validateNegativeCases proves the schemas reject malformed payloads: an unknown
// closed-registry enum value and a missing required field.
func validateNegativeCases(compiler *jsonschema.Compiler, examples string) error {
	entrySchema, err := compiler.Compile("entry.schema.json")
	if err != nil {
		return err
	}
	var entry map[string]any
	if err := readJSON(filepath.Join(examples, "entry.example.json"), &entry); err != nil {
		return err
	}
	entry["canon_level"] = "made_up_level"
	if err := entrySchema.Validate(entry); err == nil {
		return fmt.Errorf("entry schema accepted unknown canon_level")
	}

	captureSchema, err := compiler.Compile("fact-capture.schema.json")
	if err != nil {
		return err
	}
	var capture map[string]any
	if err := readJSON(filepath.Join(examples, "fact-capture.example.json"), &capture); err != nil {
		return err
	}
	delete(capture, "campaign_id")
	if err := captureSchema.Validate(capture); err == nil {
		return fmt.Errorf("fact-capture schema accepted payload missing campaign_id")
	}
	return nil
}

func readJSON(path string, target any) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(data, target); err != nil {
		return fmt.Errorf("%s: %w", path, err)
	}
	return nil
}

func contains(values []string, want string) bool {
	for _, value := range values {
		if value == want {
			return true
		}
	}
	return false
}

func stringsFromAny(items []any) []string {
	result := make([]string, 0, len(items))
	for _, item := range items {
		result = append(result, fmt.Sprint(item))
	}
	return result
}

func profileWeights(profiles map[string]any, name string) map[string]any {
	profile, ok := profiles[name].(map[string]any)
	if !ok {
		return nil
	}
	weights, _ := profile["weights"].(map[string]any)
	return weights
}

func weight(profiles map[string]any, name string, factor string) float64 {
	weights := profileWeights(profiles, name)
	value, _ := weights[factor].(float64)
	return value
}
