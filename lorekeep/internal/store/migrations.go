package store

import "embed"

//go:embed migrations/*.sql
var migrationFS embed.FS

func migrationNames() ([]string, error) {
	entries, err := migrationFS.ReadDir("migrations")
	if err != nil {
		return nil, err
	}
	names := make([]string, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() {
			names = append(names, entry.Name())
		}
	}
	return names, nil
}

func migrationSQL(name string) (string, error) {
	data, err := migrationFS.ReadFile("migrations/" + name)
	if err != nil {
		return "", err
	}
	return string(data), nil
}
