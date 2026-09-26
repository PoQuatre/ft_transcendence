package main

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/uptrace/bun/migrate"
)

func TestNormalizeMigrationName(t *testing.T) {
	tests := map[string]struct {
		input string
		want  string
	}{
		"lowercases letters":       {input: "AddUsers", want: "addusers"},
		"keeps allowed characters": {input: "add_users-v2", want: "add_users-v2"},
		"removes unsupported characters": {
			input: "Add users! 💫",
			want:  "addusers",
		},
	}

	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			if got := normalizeMigrationName(tt.input); got != tt.want {
				t.Errorf("normalizeMigrationName(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestNextMigrationNumber(t *testing.T) {
	tests := map[string]struct {
		files   []string
		want    int
		wantErr bool
	}{
		"empty directory": {
			want: 1,
		},
		"uses the next number after the largest": {
			files: []string{
				"0001_initial.tx.up.sql",
				"0001_initial.tx.down.sql",
				"0003_add_users.tx.up.sql",
			},
			want: 4,
		},
		"rejects timestamp migrations": {
			files:   []string{"20260922040044_initial.tx.up.sql"},
			wantErr: true,
		},
		"rejects numbers beyond four digits": {
			files:   []string{"10000_initial.tx.up.sql"},
			wantErr: true,
		},
		"rejects exhausted sequence": {
			files:   []string{"9999_final.tx.up.sql"},
			wantErr: true,
		},
	}

	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			dir := t.TempDir()
			for _, file := range tt.files {
				if err := os.WriteFile(filepath.Join(dir, file), nil, 0o600); err != nil {
					t.Fatal(err)
				}
			}

			got, err := nextMigrationNumber(dir)
			if tt.wantErr {
				if err == nil {
					t.Fatal("nextMigrationNumber returned nil error")
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if got != tt.want {
				t.Errorf("nextMigrationNumber() = %d, want %d", got, tt.want)
			}
		})
	}
}

func TestRenameMigrationFiles(t *testing.T) {
	dir := t.TempDir()
	up := filepath.Join(dir, "20260922040044_public_auto.tx.up.sql")
	down := filepath.Join(dir, "20260922040044_public_auto.tx.down.sql")
	for _, path := range []string{up, down} {
		if err := os.WriteFile(path, []byte("SELECT 1;"), 0o600); err != nil {
			t.Fatal(err)
		}
	}

	files := []*migrate.MigrationFile{
		{Name: filepath.Base(up), Path: up},
		{Name: filepath.Base(down), Path: down},
	}
	if err := renameMigrationFiles(files, 2, "add_users"); err != nil {
		t.Fatal(err)
	}

	for _, want := range []string{"0002_add_users.tx.up.sql", "0002_add_users.tx.down.sql"} {
		path := filepath.Join(dir, want)
		if _, err := os.Stat(path); err != nil {
			t.Errorf("renamed migration %s: %v", want, err)
		}
	}
	for _, file := range files {
		if file.Name != filepath.Base(file.Path) {
			t.Errorf("migration file metadata is inconsistent: %+v", file)
		}
	}
}
