package vault

import (
	"context"
	"testing"
)

func TestDatabaseFromRequiresNonEmptyUsernameAndPassword(t *testing.T) {
	t.Parallel()

	for _, data := range []map[string]any{
		nil,
		{"username": "user"},
		{"username": "user", "password": ""},
		{"username": 1, "password": "password"},
	} {
		_, err := databaseFrom(data)
		if err == nil {
			t.Errorf("databaseFrom(%v) error = nil", data)
		}
	}
}

func TestDatabaseFromBuildsCredentials(t *testing.T) {
	t.Parallel()

	credentials, err := databaseFrom(map[string]any{"username": "app", "password": "secret"})
	if err != nil {
		t.Fatalf("databaseFrom() error = %v", err)
	}
	if credentials.User != "app" || credentials.Password != "secret" {
		t.Errorf("credentials = %+v, want app credentials", credentials)
	}
}

func TestWaitReturnsWhenContextIsCancelled(t *testing.T) {
	t.Parallel()

	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	if wait(ctx, retryInterval) {
		t.Error("wait() = true for a cancelled context")
	}
}
