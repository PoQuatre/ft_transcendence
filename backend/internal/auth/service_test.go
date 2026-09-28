package auth

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
)

// mockRepository simule la base de données PostgreSQL/Bun en mémoire
type mockRepository struct {
	users    map[string]*User
	sessions map[string]*Session
}

func newMockRepository() *mockRepository {
	return &mockRepository{
		users:    make(map[string]*User),
		sessions: make(map[string]*Session),
	}
}

func (m *mockRepository) GetUserByEmail(ctx context.Context, email string) (*User, error) {
	if u, ok := m.users[email]; ok {
		return u, nil
	}
	return nil, ErrNotFound
}

func (m *mockRepository) CreateUser(ctx context.Context, u *User) (*User, error) {
	if _, exists := m.users[u.Email]; exists {
		return nil, ErrAlreadyExists
	}
	u.ID = uuid.New()
	m.users[u.Email] = u
	m.users[u.Username] = u
	return u, nil
}

func (m *mockRepository) GetUserByIdentifier(ctx context.Context, identifier string) (*User, error) {
	if u, ok := m.users[identifier]; ok {
		return u, nil
	}
	return nil, ErrNotFound
}

func (m *mockRepository) GetUserByID(ctx context.Context, id uuid.UUID) (*User, error) {
	for _, u := range m.users {
		if u.ID == id {
			return u, nil
		}
	}
	return nil, ErrNotFound
}

func (m *mockRepository) CreateSession(ctx context.Context, s *Session) (*Session, error) {
	m.sessions[s.ID] = s
	return s, nil
}

func (m *mockRepository) GetSessionByID(ctx context.Context, id string) (*Session, error) {
	if s, ok := m.sessions[id]; ok {
		return s, nil
	}
	return nil, ErrNotFound
}

func (m *mockRepository) DeleteSession(ctx context.Context, id string) error {
	delete(m.sessions, id)
	return nil
}

// --- TESTS DU SERVICE ---

func TestSignUp_Success(t *testing.T) {
	repo := newMockRepository()
	svc := NewService(repo)

	req := SignupRequest{
		Username: "alice",
		Email:    "alice@example.com",
		Password: "SuperPassword123!",
	}

	resp, err := svc.SignUp(context.Background(), req)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if resp.Username != "alice" || resp.Email != "alice@example.com" {
		t.Errorf("unexpected user response: %+v", resp)
	}
}

func TestSignUp_Duplicate(t *testing.T) {
	repo := newMockRepository()
	svc := NewService(repo)

	req := SignupRequest{
		Username: "alice",
		Email:    "alice@example.com",
		Password: "SuperPassword123!",
	}

	_, _ = svc.SignUp(context.Background(), req)
	_, err := svc.SignUp(context.Background(), req)

	if !errors.Is(err, ErrAlreadyExists) {
		t.Errorf("expected ErrAlreadyExists, got %v", err)
	}
}

func TestLogin_SuccessAndFailure(t *testing.T) {
	repo := newMockRepository()
	svc := NewService(repo)

	signupReq := SignupRequest{
		Username: "bob",
		Email:    "bob@example.com",
		Password: "SuperPassword123!",
	}
	_, _ = svc.SignUp(context.Background(), signupReq)

	// Test mot de passe incorrect
	_, err := svc.Login(context.Background(), LoginRequest{
		Identifier: "bob@example.com",
		Password:   "WrongPassword!",
	})
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Errorf("expected ErrInvalidCredentials, got %v", err)
	}

	// Test login réussi
	sess, err := svc.Login(context.Background(), LoginRequest{
		Identifier: "bob@example.com",
		Password:   "SuperPassword123!",
	})
	if err != nil {
		t.Fatalf("expected login success, got %v", err)
	}
	if sess.ID == "" {
		t.Error("expected non-empty session ID")
	}
}

func TestGetSession_Expired(t *testing.T) {
	repo := newMockRepository()
	svc := NewService(repo)

	// Inserer une session expiree
	expiredSession := &Session{
		ID:        "expired-id",
		UserID:    uuid.New(),
		ExpiresAt: time.Now().Add(-1 * time.Hour),
	}
	_, _ = repo.CreateSession(context.Background(), expiredSession)

	_, err := svc.GetSession(context.Background(), "expired-id")
	if !errors.Is(err, ErrSessionExpired) {
		t.Errorf("expected ErrSessionExpired, got %v", err)
	}
}
