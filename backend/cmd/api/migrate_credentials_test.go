package main

import (
	"context"
	"strings"
	"testing"
)

func TestMigrationCredentialsFromEnv(t *testing.T) {
	t.Setenv(migrateCredentialsSourceVar, migrateCredentialsSourceEnv)
	t.Setenv(migrateDBUserVar, "app_migrate")
	t.Setenv(migrateDBPasswordVar, "password")

	source, err := migrationCredentials(context.Background())
	if err != nil {
		t.Fatal(err)
	}

	if got, want := source.DBCredentials().User, "app_migrate"; got != want {
		t.Errorf("DBCredentials().User = %q, want %q", got, want)
	}
	if got, want := source.DBCredentials().Password, "password"; got != want {
		t.Errorf("DBCredentials().Password = %q, want %q", got, want)
	}
}

func TestMigrationCredentialsFromEnvRequiresValues(t *testing.T) {
	tests := map[string]struct {
		user     string
		password string
		want     string
	}{
		"user": {
			want: migrateDBUserVar,
		},
		"password": {
			user: "app_migrate",
			want: migrateDBPasswordVar,
		},
	}

	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			t.Setenv(migrateCredentialsSourceVar, migrateCredentialsSourceEnv)
			t.Setenv(migrateDBUserVar, tt.user)
			t.Setenv(migrateDBPasswordVar, tt.password)

			_, err := migrationCredentials(context.Background())
			if err == nil || !strings.Contains(err.Error(), tt.want) {
				t.Errorf("migrationCredentials() error = %v, want an error mentioning %s", err, tt.want)
			}
		})
	}
}

func TestMigrationCredentialsRejectsUnknownSource(t *testing.T) {
	t.Setenv(migrateCredentialsSourceVar, "unknown")

	_, err := migrationCredentials(context.Background())
	if err == nil || !strings.Contains(err.Error(), migrateCredentialsSourceVar) {
		t.Errorf("migrationCredentials() error = %v, want an error mentioning %s", err, migrateCredentialsSourceVar)
	}
}
