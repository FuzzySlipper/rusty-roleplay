package store

import (
	"encoding/json"
	"regexp"
	"strings"
)

func marshalStrings(values []string) string {
	if values == nil {
		values = []string{}
	}
	data, err := json.Marshal(values)
	if err != nil {
		return "[]"
	}
	return string(data)
}

func unmarshalStrings(raw string) []string {
	if raw == "" {
		return nil
	}
	var values []string
	if err := json.Unmarshal([]byte(raw), &values); err != nil {
		return nil
	}
	return values
}

func marshalJSON(value any) string {
	data, err := json.Marshal(value)
	if err != nil {
		return "{}"
	}
	return string(data)
}

var ftsTokenPattern = regexp.MustCompile(`[a-zA-Z0-9]+`)

// ftsMatchExpr turns free text into a safe FTS5 MATCH expression: each
// alphanumeric token is quoted and the tokens are OR-ed. Returns "" when the
// query has no usable tokens, signaling callers to fall back to non-FTS listing.
func ftsMatchExpr(query string) string {
	tokens := ftsTokenPattern.FindAllString(query, -1)
	if len(tokens) == 0 {
		return ""
	}
	quoted := make([]string, 0, len(tokens))
	for _, token := range tokens {
		quoted = append(quoted, `"`+strings.ToLower(token)+`"`)
	}
	return strings.Join(quoted, " OR ")
}
