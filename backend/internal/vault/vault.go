// Package vault loads backend secrets from HashiCorp Vault.
package vault

import (
	"context"
	"fmt"
	"os"

	"github.com/hashicorp/vault/api"
)

type Config struct {
	Addr         string
	RoleID       string
	SecretIDPath string
	DBCredsPath  string
}

type ConfigOptions struct {
	RoleIDEnv       string
	SecretIDPathEnv string
	DBCredsPath     string
}

func ConfigFromEnv() (Config, error) {
	return ConfigFromEnvWith(ConfigOptions{
		RoleIDEnv:       "BACKEND_ROLE_ID",
		SecretIDPathEnv: "BACKEND_SECRET_ID_PATH",
		DBCredsPath:     "database/creds/app-readwrite",
	})
}

func ConfigFromEnvWith(opts ConfigOptions) (Config, error) {
	if opts.RoleIDEnv == "" {
		return Config{}, ErrNoRoleIDEnv
	}
	if opts.SecretIDPathEnv == "" {
		return Config{}, ErrNoSecretIDPathEnv
	}
	if opts.DBCredsPath == "" {
		return Config{}, ErrNoDBCredsPath
	}

	roleID := os.Getenv(opts.RoleIDEnv)
	if roleID == "" {
		return Config{}, ErrEmptyRoleID
	}
	secretIDPath := os.Getenv(opts.SecretIDPathEnv)
	if secretIDPath == "" {
		return Config{}, ErrEmptySecretIDPath
	}
	addr := os.Getenv("VAULT_ADDR")
	if addr == "" {
		return Config{}, ErrEmptyVaultAddr
	}

	return Config{
		Addr:         addr,
		RoleID:       roleID,
		SecretIDPath: secretIDPath,
		DBCredsPath:  opts.DBCredsPath,
	}, nil
}

func Start(ctx context.Context, cfg Config) (*Client, error) {
	if cfg.Addr == "" {
		return nil, ErrEmptyVaultAddr
	}
	if cfg.RoleID == "" {
		return nil, ErrEmptyRoleID
	}
	if cfg.SecretIDPath == "" {
		return nil, ErrEmptySecretIDPath
	}
	if cfg.DBCredsPath == "" {
		return nil, ErrNoDBCredsPath
	}

	apiCfg := api.DefaultConfig()
	apiCfg.Address = cfg.Addr
	client, err := api.NewClient(apiCfg)
	if err != nil {
		return nil, fmt.Errorf("create vault client: %w", err)
	}

	vault := &Client{
		api:             client,
		databaseChanged: make(chan struct{}, 1),
		config:          cfg,
	}
	secret, err := vault.login(ctx)
	if err != nil {
		return nil, err
	}
	if err := vault.reload(ctx); err != nil {
		return nil, err
	}

	go vault.renew(ctx, secret)
	return vault, nil
}
