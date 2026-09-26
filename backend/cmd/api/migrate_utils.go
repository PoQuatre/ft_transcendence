package main

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/uptrace/bun/migrate"
)

var (
	migrationFileRE   = regexp.MustCompile(`^(\d{1,14})_[0-9a-z_-]+\.(?:tx\.)?(?:up|down)\.sql$`)
	migrationSuffixes = []string{".tx.up.sql", ".tx.down.sql", ".up.sql", ".down.sql"}
)

func migrationsDirectory() string {
	if dir := os.Getenv("MIGRATIONS_DIR"); dir != "" {
		return dir
	}
	return defaultMigrationsDir
}

func discoverMigrations(dir string) (*migrate.Migrations, error) {
	collection := migrate.NewMigrations(migrate.WithMigrationsDirectory(dir))
	if err := collection.Discover(os.DirFS(dir)); err != nil {
		return nil, fmt.Errorf("discover SQL migrations in %s: %w", dir, err)
	}
	return collection, nil
}

func normalizeMigrationName(name string) string {
	return strings.Map(func(r rune) rune {
		if r >= 'A' && r <= 'Z' {
			return r + ('a' - 'A')
		}
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_' || r == '-' {
			return r
		}
		return -1
	}, name)
}

func nextMigrationNumber(dir string) (int, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return 0, err
	}

	maxNumber := 0
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		matches := migrationFileRE.FindStringSubmatch(entry.Name())
		if matches == nil {
			continue
		}
		if len(matches[1]) != 4 {
			return 0, fmt.Errorf("cannot mix numbered migrations with %q", entry.Name())
		}

		number, err := strconv.Atoi(matches[1])
		if err != nil {
			return 0, fmt.Errorf("parse migration number in %q: %w", entry.Name(), err)
		}

		maxNumber = max(maxNumber, number)
	}

	if maxNumber == 9999 {
		return 0, errors.New("migration number limit (9999) reached")
	}
	return maxNumber + 1, nil
}

func renameMigrationFiles(files []*migrate.MigrationFile, number int, name string) error {
	if len(files) != 2 {
		return fmt.Errorf("got %d files, want up and down migration files", len(files))
	}

	type rename struct {
		file *migrate.MigrationFile
		from string
		to   string
	}
	renames := make([]rename, 0, len(files))
	seenSuffixes := make(map[string]bool, len(files))
	for _, file := range files {
		suffix, ok := migrationFileSuffix(file.Name)
		if !ok || seenSuffixes[suffix] {
			return fmt.Errorf("unsupported generated migration file %q", file.Name)
		}
		seenSuffixes[suffix] = true

		filename := fmt.Sprintf("%04d_%s%s", number, name, suffix)
		renames = append(renames, rename{
			file: file,
			from: file.Path,
			to:   filepath.Join(filepath.Dir(file.Path), filename),
		})
	}

	for _, rename := range renames {
		if _, err := os.Stat(rename.to); err == nil {
			return fmt.Errorf("migration file already exists: %s", rename.to)
		} else if !os.IsNotExist(err) {
			return err
		}
	}

	for i, rename := range renames {
		if err := os.Rename(rename.from, rename.to); err != nil {
			for j := i - 1; j >= 0; j-- {
				err = errors.Join(err, os.Rename(renames[j].to, renames[j].from))
			}
			return err
		}
	}

	for _, rename := range renames {
		rename.file.Name = filepath.Base(rename.to)
		rename.file.Path = rename.to
	}
	return nil
}

func migrationFileSuffix(name string) (string, bool) {
	for _, suffix := range migrationSuffixes {
		if strings.HasSuffix(name, suffix) {
			return suffix, true
		}
	}
	return "", false
}
