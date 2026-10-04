package auth

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
)

type mockRepository struct {
	users map[string]*User
}

func newMockRepository() *mockRepository {
	return &mockRepository{
		users: make(map[string]*User),
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

// --- SERVICE TESTS ---

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

	_, err := svc.Login(context.Background(), LoginRequest{
		Identifier: "bob@example.com",
		Password:   "WrongPassword!",
	})
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Errorf("expected ErrInvalidCredentials, got %v", err)
	}

	userResp, err := svc.Login(context.Background(), LoginRequest{
		Identifier: "bob@example.com",
		Password:   "SuperPassword123!",
	})
	if err != nil {
		t.Fatalf("expected login success, got %v", err)
	}
	if userResp.Username != "bob" || userResp.Email != "bob@example.com" {
		t.Errorf("unexpected user response after login: %+v", userResp)
	}
}

func TestGetUserByID_SuccessAndNotFound(t *testing.T) {
	repo := newMockRepository()
	svc := NewService(repo)

	signupReq := SignupRequest{
		Username: "charlie",
		Email:    "charlie@example.com",
		Password: "SuperPassword123!",
	}
	createdUser, _ := svc.SignUp(context.Background(), signupReq)

	userID, err := uuid.Parse(createdUser.ID)
	if err != nil {
		t.Fatalf("failed to parse UUID: %v", err)
	}

	userResp, err := svc.GetUserByID(context.Background(), userID)
	if err != nil {
		t.Fatalf("expected to find user, got %v", err)
	}
	if userResp.Username != "charlie" {
		t.Errorf("expected username 'charlie', got %s", userResp.Username)
	}

	_, err = svc.GetUserByID(context.Background(), uuid.New())
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}
