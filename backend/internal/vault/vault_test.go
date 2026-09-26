package vault

import (
	"errors"
	"testing"
)

func TestConfigFromEnvWith(t *testing.T) {
	opts := ConfigOptions{
		RoleIDEnv:       "TEST_VAULT_ROLE_ID",
		SecretIDPathEnv: "TEST_VAULT_SECRET_ID_PATH",
		DBCredsPath:     "database/creds/test",
	}

	t.Run("loads configuration", func(t *testing.T) {
		t.Setenv(opts.RoleIDEnv, "role-id")
		t.Setenv(opts.SecretIDPathEnv, "/run/secrets/role-id")
		t.Setenv("VAULT_ADDR", "https://vault.example.test")

		got, err := ConfigFromEnvWith(opts)
		if err != nil {
			t.Fatal(err)
		}
		want := Config{
			Addr:         "https://vault.example.test",
			RoleID:       "role-id",
			SecretIDPath: "/run/secrets/role-id",
			DBCredsPath:  "database/creds/test",
		}
		if got != want {
			t.Errorf("ConfigFromEnvWith() = %+v, want %+v", got, want)
		}
	})

	tests := map[string]struct {
		opts ConfigOptions
		role string
		path string
		addr string
		want error
	}{
		"requires role ID environment variable name":        {opts: ConfigOptions{SecretIDPathEnv: opts.SecretIDPathEnv, DBCredsPath: opts.DBCredsPath}, want: ErrNoRoleIDEnv},
		"requires secret ID path environment variable name": {opts: ConfigOptions{RoleIDEnv: opts.RoleIDEnv, DBCredsPath: opts.DBCredsPath}, want: ErrNoSecretIDPathEnv},
		"requires database credentials path":                {opts: ConfigOptions{RoleIDEnv: opts.RoleIDEnv, SecretIDPathEnv: opts.SecretIDPathEnv}, want: ErrNoDBCredsPath},
		"requires role ID value":                            {opts: opts, want: ErrEmptyRoleID},
		"requires secret ID path value":                     {opts: opts, role: "role-id", want: ErrEmptySecretIDPath},
		"requires Vault address":                            {opts: opts, role: "role-id", path: "/role-id", want: ErrEmptyVaultAddr},
	}
	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			if tt.opts.RoleIDEnv != "" {
				t.Setenv(tt.opts.RoleIDEnv, tt.role)
			}
			if tt.opts.SecretIDPathEnv != "" {
				t.Setenv(tt.opts.SecretIDPathEnv, tt.path)
			}
			t.Setenv("VAULT_ADDR", tt.addr)

			_, err := ConfigFromEnvWith(tt.opts)
			if !errors.Is(err, tt.want) {
				t.Errorf("ConfigFromEnvWith() error = %v, want %v", err, tt.want)
			}
		})
	}
}

func TestStartValidatesConfig(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		cfg  Config
		want error
	}{
		{name: "address", want: ErrEmptyVaultAddr},
		{name: "role ID", cfg: Config{Addr: "http://vault", SecretIDPath: "/secret", DBCredsPath: "database/creds/app"}, want: ErrEmptyRoleID},
		{name: "secret ID path", cfg: Config{Addr: "http://vault", RoleID: "role", DBCredsPath: "database/creds/app"}, want: ErrEmptySecretIDPath},
		{name: "credentials path", cfg: Config{Addr: "http://vault", RoleID: "role", SecretIDPath: "/secret"}, want: ErrNoDBCredsPath},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := Start(t.Context(), tt.cfg)
			if !errors.Is(err, tt.want) {
				t.Errorf("Start() error = %v, want %v", err, tt.want)
			}
		})
	}
}
