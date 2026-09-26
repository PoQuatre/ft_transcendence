package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"

	"github.com/PoQuatre/ft_transcendence/backend/internal/database"

	"github.com/spf13/cobra"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/migrate"
)

const defaultMigrationsDir = "migrations"

func newMigrateCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "migrate",
		Short: "Manage database migrations",
	}

	cmd.AddCommand(
		newMigrateGenerateCmd(),
		newMigrateUpCmd(),
		newMigrateDownCmd(),
		newMigrateStatusCmd(),
	)

	return cmd
}

func newMigrator(ctx context.Context) (*migrate.Migrator, func(), error) {
	dir := migrationsDirectory()

	migrations, err := discoverMigrations(dir)
	if err != nil {
		return nil, nil, fmt.Errorf("discover migrations: %w", err)
	}

	db, cleanup, err := newDB(ctx)
	if err != nil {
		return nil, nil, err
	}

	return migrate.NewMigrator(db, migrations, migrate.WithMarkAppliedOnSuccess(true)), cleanup, nil
}

func newAutoMigrator(ctx context.Context) (*migrate.AutoMigrator, func(), error) {
	db, cleanup, err := newDB(ctx)
	if err != nil {
		return nil, nil, err
	}

	dir := migrationsDirectory()

	err = os.MkdirAll(dir, 0o750)
	if err != nil {
		cleanup()
		return nil, nil, fmt.Errorf("create migrations directory: %w", err)
	}

	autoMigrator, err := migrate.NewAutoMigrator(
		db,
		migrate.WithModel(database.Models()...),
		migrate.WithMigrationsDirectoryAuto(dir),
	)
	if err != nil {
		cleanup()
		return nil, nil, fmt.Errorf("create automatic migrator: %w", err)
	}

	return autoMigrator, cleanup, nil
}

func newDB(ctx context.Context) (*bun.DB, func(), error) {
	credentials, err := migrationCredentials(ctx)
	if err != nil {
		return nil, nil, err
	}

	db, err := database.NewDB(ctx, credentials)
	if err != nil {
		return nil, nil, fmt.Errorf("connect database: %w", err)
	}

	cleanup := func() {
		if err := db.Close(); err != nil {
			slog.Error("close database", "error", err)
		}
	}

	return db, cleanup, nil
}

func initializeAndLock(ctx context.Context, migrator *migrate.Migrator) (func(), error) {
	if err := migrator.Init(ctx); err != nil {
		return nil, fmt.Errorf("initialize migration tables: %w", err)
	}
	if err := migrator.Lock(ctx); err != nil {
		return nil, fmt.Errorf("lock migrations: %w", err)
	}

	return func() {
		if err := migrator.Unlock(ctx); err != nil {
			slog.Warn("unlock migrations", "error", err)
		}
	}, nil
}

func newMigrateGenerateCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "generate NAME",
		Short: "Generate a migration from Bun models",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			name := normalizeMigrationName(args[0])
			if name == "" {
				return fmt.Errorf("migration name %q has no valid characters", args[0])
			}

			ctx := cmd.Context()

			autoMigrator, cleanup, err := newAutoMigrator(ctx)
			if err != nil {
				return err
			}
			defer cleanup()

			number, err := nextMigrationNumber(migrationsDirectory())
			if err != nil {
				return fmt.Errorf("determine next migration number: %w", err)
			}

			files, err := autoMigrator.CreateTxSQLMigrations(ctx)
			if err != nil {
				return fmt.Errorf("generate migration: %w", err)
			}
			if len(files) == 0 {
				fmt.Println("database schema matches Bun models")
				return nil
			}

			if err := renameMigrationFiles(files, number, name); err != nil {
				return fmt.Errorf("rename generated migration files: %w", err)
			}

			for _, mf := range files {
				fmt.Printf("created migration %s (%s)\n", mf.Name, mf.Path)
			}

			return nil
		},
	}
}

func newMigrateUpCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "up",
		Short: "Run pending migrations",
		RunE: func(cmd *cobra.Command, _ []string) error {
			ctx := cmd.Context()

			migrator, cleanup, err := newMigrator(ctx)
			if err != nil {
				return err
			}
			defer cleanup()

			unlock, err := initializeAndLock(ctx, migrator)
			if err != nil {
				return err
			}
			defer unlock()

			group, err := migrator.Migrate(ctx)
			if err != nil {
				return err
			}

			if group.ID == 0 {
				fmt.Printf("there are no new migrations to run\n")
				return nil
			}

			fmt.Printf("migrated to %s\n", group)
			return nil
		},
	}
}

func newMigrateDownCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "down",
		Short: "Rollback the latest migration",
		RunE: func(cmd *cobra.Command, _ []string) error {
			ctx := cmd.Context()

			migrator, cleanup, err := newMigrator(ctx)
			if err != nil {
				return err
			}
			defer cleanup()

			unlock, err := initializeAndLock(ctx, migrator)
			if err != nil {
				return err
			}
			defer unlock()

			group, err := migrator.Rollback(ctx)
			if err != nil {
				return err
			}

			if group.ID == 0 {
				fmt.Printf("there are no groups to roll back\n")
				return nil
			}

			fmt.Printf("rolled back %s\n", group)
			return nil
		},
	}
}

func newMigrateStatusCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "status",
		Short: "Show migration status",
		RunE: func(cmd *cobra.Command, _ []string) error {
			ctx := cmd.Context()

			migrator, cleanup, err := newMigrator(ctx)
			if err != nil {
				return err
			}
			defer cleanup()

			err = migrator.Init(ctx)
			if err != nil {
				return fmt.Errorf("initialize migration tables: %w", err)
			}

			ms, err := migrator.MigrationsWithStatus(ctx)
			if err != nil {
				return err
			}
			fmt.Printf("migrations: %s\n", ms)
			fmt.Printf("unapplied migrations: %s\n", ms.Unapplied())
			fmt.Printf("last migration group: %s\n", ms.LastGroup())

			return nil
		},
	}
}
