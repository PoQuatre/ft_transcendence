package auth

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

type MockMessage struct {
	SenderID   uuid.UUID
	ReceiverID uuid.UUID
	Body       string
	CreatedAt  time.Time
}

type mockRepository struct {
	apiKeys             map[uuid.UUID]*APIKey
	apiKeyUses          int
	users               map[string]*User
	usersverifs         map[uuid.UUID]*UserVerify
	newmailverifs       map[uuid.UUID]*NewMailVerify
	passwordresettokens map[uuid.UUID]*PasswordResetToken

	friends        map[uuid.UUID][]uuid.UUID
	friendRequests map[uuid.UUID][]uuid.UUID
	messages       []MockMessage
}

func newMockRepository() *mockRepository {
	return &mockRepository{
		apiKeys:             make(map[uuid.UUID]*APIKey),
		users:               make(map[string]*User),
		usersverifs:         make(map[uuid.UUID]*UserVerify),
		newmailverifs:       make(map[uuid.UUID]*NewMailVerify),
		passwordresettokens: make(map[uuid.UUID]*PasswordResetToken),
	}
}

func (m *mockRepository) DeleteNewMailVerification(ctx context.Context, userID uuid.UUID) error {
	delete(m.newmailverifs, userID)
	return nil
}

func (m *mockRepository) GetNewMailVerificationByID(ctx context.Context, id uuid.UUID) (*NewMailVerify, error) {
	if verif, ok := m.newmailverifs[id]; ok {
		return verif, nil
	}
	return nil, ErrNotFound
}

func (m *mockRepository) CreateNewMailVerification(ctx context.Context, user *NewMailVerify) (*NewMailVerify, error) {
	m.newmailverifs[user.UserID] = user
	return user, nil
}

func (m *mockRepository) GetUserByUsername(ctx context.Context, username string) (*User, error) {
	if u, ok := m.users[strings.ToLower(username)]; ok {
		return u, nil
	}
	return nil, ErrNotFound
}

func (m *mockRepository) GetPasswordResetToken(ctx context.Context, tokenHash string) (*PasswordResetToken, error) {
	for _, token := range m.passwordresettokens {
		if token.TokenHash == tokenHash {
			return token, nil
		}
	}

	return nil, fmt.Errorf("password reset token not found: %w", sql.ErrNoRows)
}

func (m *mockRepository) DeletePasswordResetToken(ctx context.Context, tokenID uuid.UUID) error {
	if _, exists := m.passwordresettokens[tokenID]; !exists {
		return errors.New("password reset token not found")
	}

	delete(m.passwordresettokens, tokenID)
	return nil
}

func (m *mockRepository) CreatePasswordResetToken(ctx context.Context, reset *PasswordResetToken) (*PasswordResetToken, error) {
	for id, token := range m.passwordresettokens {
		if token.UserID == reset.UserID {
			delete(m.passwordresettokens, id)
		}
	}

	if reset.ID == uuid.Nil {
		var err error
		reset.ID, err = uuid.NewRandom()
		if err != nil {
			return nil, fmt.Errorf("failed to generate uuid for mock token: %w", err)
		}
	}

	m.passwordresettokens[reset.ID] = reset

	return reset, nil
}

func (m *mockRepository) SetNewPasswordToUser(ctx context.Context, user *User, passwordhash string) (*User, error) {
	if _, exists := m.users[user.Email]; !exists {
		return nil, ErrNotFound
	}
	user.PasswordHash = passwordhash
	m.users[user.Email] = user
	return user, nil
}

func (m *mockRepository) CreateUserVerification(ctx context.Context, user *UserVerify) (*UserVerify, error) {
	if _, exists := m.usersverifs[user.UserID]; exists {
		return nil, ErrAlreadyExists
	}
	m.usersverifs[user.UserID] = user
	return user, nil
}

func (m *mockRepository) GetUserVerificationByID(ctx context.Context, id uuid.UUID) (*UserVerify, error) {
	if _, exists := m.usersverifs[id]; !exists {
		return nil, ErrNotFound
	}
	return m.usersverifs[id], nil
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
	lowerUser := strings.ToLower(u.Username)
	if _, exists := m.users[lowerUser]; exists {
		return nil, ErrUsernameAlreadyExists
	}
	u.ID = uuid.New()
	m.users[u.Email] = u
	m.users[u.Username] = u
	return u, nil
}

func (m *mockRepository) MarkEmailAsVerified(ctx context.Context, id uuid.UUID) error {
	for _, u := range m.users {
		if u.ID == id {
			u.Verified = true
			return nil
		}
	}
	return ErrNotFound
}

func (m *mockRepository) GetUserByID(ctx context.Context, id uuid.UUID) (*User, error) {
	for _, u := range m.users {
		if u.ID == id {
			return u, nil
		}
	}
	return nil, ErrNotFound
}

func (m *mockRepository) GetUserPasswordHash(ctx context.Context, userID uuid.UUID) (string, error) {
	for _, u := range m.users {
		if u.ID == userID {
			return u.PasswordHash, nil
		}
	}
	return "", ErrNotFound
}

func (m *mockRepository) DeleteUser(ctx context.Context, userID uuid.UUID) error {
	var target *User
	for _, u := range m.users {
		if u.ID == userID {
			target = u
			break
		}
	}
	if target == nil {
		return nil
	}
	delete(m.users, target.Email)
	delete(m.users, strings.ToLower(target.Username))
	return nil
}

func (m *mockRepository) DeleteEmailVerifToken(ctx context.Context, userID uuid.UUID) error {
	delete(m.usersverifs, userID)
	return nil
}

func (m *mockRepository) DeletePasswordTokenFromUserID(ctx context.Context, userID uuid.UUID) error {
	for id, token := range m.passwordresettokens {
		if token.UserID == userID {
			delete(m.passwordresettokens, id)
		}
	}
	return nil
}

func (m *mockRepository) DeleteFriendRequestsWithUserID(ctx context.Context, userID uuid.UUID) error {
	if m.friendRequests == nil {
		return nil
	}
	delete(m.friendRequests, userID)

	for senderID, receivers := range m.friendRequests {
		var filtered []uuid.UUID
		for _, rID := range receivers {
			if rID != userID {
				filtered = append(filtered, rID)
			}
		}
		m.friendRequests[senderID] = filtered
	}
	return nil
}

func (m *mockRepository) DeleteFriendRelationsWithUserID(ctx context.Context, userID uuid.UUID) error {
	if m.friends == nil {
		return nil
	}
	delete(m.friends, userID)

	for uID, friendList := range m.friends {
		var filtered []uuid.UUID
		for _, fID := range friendList {
			if fID != userID {
				filtered = append(filtered, fID)
			}
		}
		m.friends[uID] = filtered
	}
	return nil
}

func (m *mockRepository) DeleteFriendMessagesFromUserID(ctx context.Context, userID uuid.UUID) error {
	if m.messages == nil {
		return nil
	}
	var filtered []MockMessage
	for _, msg := range m.messages {
		if msg.SenderID != userID {
			filtered = append(filtered, msg)
		}
	}
	m.messages = filtered
	return nil
}

func (m *mockRepository) UpdateEmail(ctx context.Context, userID uuid.UUID, email string) error {
	for _, u := range m.users {
		if u.ID == userID {
			delete(m.users, u.Email)
			u.Email = email
			u.Verified = false
			m.users[email] = u
			return nil
		}
	}
	return nil
}

func (m *mockRepository) UpdateUsername(ctx context.Context, userID uuid.UUID, username string) error {
	lowerNew := strings.ToLower(username)
	for _, u := range m.users {
		if u.ID != userID && strings.ToLower(u.Username) == lowerNew {
			return ErrUsernameAlreadyExists
		}
	}
	for _, u := range m.users {
		if u.ID == userID {
			delete(m.users, strings.ToLower(u.Username))
			u.Username = username
			m.users[lowerNew] = u
			return nil
		}
	}
	return nil
}

func (m *mockRepository) GetFriendListFromUserID(ctx context.Context, userID uuid.UUID) ([]string, error) {
	friends := []string{}
	if m.friends == nil {
		return friends, nil
	}

	friendIDs := make(map[uuid.UUID]bool)
	for _, fID := range m.friends[userID] {
		friendIDs[fID] = true
	}
	for uID, list := range m.friends {
		for _, fID := range list {
			if fID == userID {
				friendIDs[uID] = true
			}
		}
	}

	for fID := range friendIDs {
		if u, err := m.GetUserByID(ctx, fID); err == nil {
			friends = append(friends, u.Username)
		}
	}
	return friends, nil
}

func (m *mockRepository) GetFriendRequestsFromUserID(ctx context.Context, userID uuid.UUID) ([]string, error) {
	friendsReq := []string{}
	if m.friendRequests == nil {
		return friendsReq, nil
	}

	for _, receiverID := range m.friendRequests[userID] {
		if u, err := m.GetUserByID(ctx, receiverID); err == nil {
			friendsReq = append(friendsReq, u.Username)
		}
	}
	return friendsReq, nil
}

func (m *mockRepository) GetFriendRequestsToUserID(ctx context.Context, userID uuid.UUID) ([]string, error) {
	friendsReq := []string{}
	if m.friendRequests == nil {
		return friendsReq, nil
	}

	for senderID, receivers := range m.friendRequests {
		for _, receiverID := range receivers {
			if receiverID == userID {
				if u, err := m.GetUserByID(ctx, senderID); err == nil {
					friendsReq = append(friendsReq, u.Username)
				}
			}
		}
	}
	return friendsReq, nil
}

func (m *mockRepository) GetMessagesFromUserID(ctx context.Context, userID uuid.UUID) ([]MessageExport, error) {
	exports := []MessageExport{}
	if m.messages == nil {
		return exports, nil
	}

	for _, msg := range m.messages {
		if msg.SenderID == userID {
			receiverName := ""
			if u, err := m.GetUserByID(ctx, msg.ReceiverID); err == nil {
				receiverName = u.Username
			}
			exports = append(exports, MessageExport{
				ReceiverName: receiverName,
				Body:         msg.Body,
				SentAt:       msg.CreatedAt,
			})
		}
	}
	return exports, nil
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

	_, err := svc.SignUp(context.Background(), req)
	if err != nil {
		t.Errorf("SignUp Failed : %v", err)
	}
	_, err = svc.SignUp(context.Background(), req)

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
	_, err := svc.SignUp(context.Background(), signupReq)
	if err != nil {
		t.Errorf("SignUp Failed : %v", err)
	}
	_, err = svc.Login(context.Background(), LoginRequest{
		Email:    "bob@example.com",
		Password: "WrongPassword!",
	})
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Errorf("expected ErrInvalidCredentials, got %v", err)
	}

	userResp, err := svc.Login(context.Background(), LoginRequest{
		Email:    "bob@example.com",
		Password: "SuperPassword123!",
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
	createdUser, err := svc.SignUp(context.Background(), signupReq)
	if err != nil {
		t.Errorf("SignUp failed : %v", err)
	}
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
