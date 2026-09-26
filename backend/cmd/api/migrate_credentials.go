package main

import (
	"context"
	"fmt"
	"os"

	"github.com/PoQuatre/ft_transcendence/backend/internal/database"
	"github.com/PoQuatre/ft_transcendence/backend/internal/vault"
)

const (
	migrateCredentialsSourceEnv = "env"
	migrateCredentialsSourceVar = "MIGRATE_CREDENTIALS_SOURCE" //nolint:gosec // Environment variable name, not credentials.
	migrateDBUserVar            = "MIGRATE_DB_USER"
	migrateDBPasswordVar        = "MIGRATE_DB_PASSWORD" //nolint:gosec // Environment variable name, not credentials.
)

func migrationCredentials(ctx context.Context) (database.CredentialsSource, error) {
	switch source := os.Getenv(migrateCredentialsSourceVar); source {
	case "", "vault":
		vaultConfig, err := vault.ConfigFromEnvWith(vault.ConfigOptions{
			RoleIDEnv:       "MIGRATE_ROLE_ID",
			SecretIDPathEnv: "MIGRATE_SECRET_ID_PATH",
			DBCredsPath:     "database/creds/app-migrate",
		})
		if err != nil {
			return nil, fmt.Errorf("load Vault configuration: %w", err)
		}
		vaultClient, err := vault.Start(ctx, vaultConfig)
		if err != nil {
			return nil, fmt.Errorf("start Vault client: %w", err)
		}
		return vaultClient, nil

	case migrateCredentialsSourceEnv:
		user := os.Getenv(migrateDBUserVar)
		if user == "" {
			return nil, fmt.Errorf("%s is empty or unset", migrateDBUserVar)
		}
		password := os.Getenv(migrateDBPasswordVar)
		if password == "" {
			return nil, fmt.Errorf("%s is empty or unset", migrateDBPasswordVar)
		}
		return database.NewStaticCredentialsSource(user, password), nil

	default:
		return nil, fmt.Errorf("unsupported %s %q", migrateCredentialsSourceVar, source)
	}
}
