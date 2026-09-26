package vault

import "errors"

var (
	ErrNoRoleIDEnv       = errors.New("vault role ID env var is required")
	ErrNoSecretIDPathEnv = errors.New("vault secret ID path env par is required")
	ErrNoDBCredsPath     = errors.New("vault database credentials path is reqired")

	ErrEmptyRoleID       = errors.New("vault role ID env var is empty or unset")
	ErrEmptySecretIDPath = errors.New("vault secret ID path env var is empty or unset")
	ErrEmptyVaultAddr    = errors.New("VAULT_ADDR is empty or unset")

	ErrNoClientToken = errors.New("vault returned no client token")
)
