package database

import (
	"context"
	"testing"
	"time"
)

type mutableCredentialsSource struct {
	credentials *Credentials
	changed     chan struct{}
}

func (s *mutableCredentialsSource) DBCredentials() *Credentials           { return s.credentials }
func (s *mutableCredentialsSource) DBCredentialsChanged() <-chan struct{} { return s.changed }

func TestRotatingConnectorCurrentCredentials(t *testing.T) {
	t.Parallel()

	connector := &RotatingConnector{credentials: &mutableCredentialsSource{}}
	if _, err := connector.currentCredentials(); err == nil {
		t.Fatal("currentCredentials() returned nil error for nil credentials")
	}

	want := Credentials{User: "app", Password: "secret", Generation: 3}
	connector.credentials = &mutableCredentialsSource{credentials: &want}
	got, err := connector.currentCredentials()
	if err != nil {
		t.Fatal(err)
	}
	if got != want {
		t.Errorf("currentCredentials() = %+v, want %+v", got, want)
	}
}

func TestRotatingConnectorRotate(t *testing.T) {
	t.Parallel()

	connector := &RotatingConnector{dsnTmpl: "postgres://{{user-passwd}}@database/app"}
	first := Credentials{User: "app user", Password: "secret/pass", Generation: 1}
	connector.rotate(first)
	state := connector.state.Load()
	if state == nil || state.generation != first.Generation || state.connector == nil {
		t.Fatalf("rotate() state = %+v, want initialized generation %d", state, first.Generation)
	}

	connector.rotate(first)
	if got := connector.state.Load(); got != state {
		t.Error("rotate() replaced state for the same generation")
	}

	connector.rotate(Credentials{User: "app", Password: "next", Generation: 2})
	if got := connector.state.Load(); got == state || got.generation != 2 {
		t.Errorf("rotate() state = %+v, want new generation 2", got)
	}
}

func TestRotatingConnectorConnectRequiresInitialization(t *testing.T) {
	t.Parallel()

	connector := &RotatingConnector{}
	if _, err := connector.Connect(context.Background()); err == nil {
		t.Fatal("Connect() returned nil error for uninitialized connector")
	}
	if connector.Driver() == nil {
		t.Fatal("Driver() returned nil")
	}
}

func TestRotatingConnectorWatchCredentials(t *testing.T) {
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	source := &mutableCredentialsSource{
		credentials: &Credentials{User: "app", Password: "first", Generation: 1},
		changed:     make(chan struct{}, 1),
	}
	connector := &RotatingConnector{credentials: source, dsnTmpl: "postgres://{{user-passwd}}@database/app"}
	go connector.watchCredentials(ctx)

	source.changed <- struct{}{}
	timeout := time.NewTimer(time.Second)
	defer timeout.Stop()
	for {
		if state := connector.state.Load(); state != nil && state.generation == 1 {
			return
		}
		select {
		case <-timeout.C:
			t.Fatal("watchCredentials did not rotate credentials")
		case <-time.After(time.Millisecond):
		}
	}
}
