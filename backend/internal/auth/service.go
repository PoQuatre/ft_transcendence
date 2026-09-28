package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	// "hash"

	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrSessionExpired     = errors.New("session expired")
)

type Service interface {
	SignUp(ctx context.Context, req SignupRequest) (*UserResponse, error)
	Login(ctx context.Context, req LoginRequest) (*Session, error)
	GetSession(ctx context.Context, sessionID string) (*UserResponse, error)
	Logout(ctx context.Context, sessionID string) error
}

type service struct {
	repo Repository
}

func NewService(repo Repository) Service {
	return &service{repo: repo}
}

func generateSessionID() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

func toUserResponse(user *User) *UserResponse {
	if user == nil {
		return nil
	}
	return &UserResponse{
		ID:       user.ID.String(),
		Username: user.Username,
		Email:    user.Email,
	}
}

func (s *service) SignUp(ctx context.Context, req SignupRequest) (*UserResponse, error) {
	req.Email = strings.TrimSpace(req.Email)
	req.Username = strings.TrimSpace(req.Username)
	if req.Email == "" || req.Password == "" || req.Username == "" {
		return nil, ErrInvalidCredentials
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	user := &User{
		Username:     req.Username,
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
	}
	createdUser, err := s.repo.CreateUser(ctx, user)
	if err != nil {
		return nil, err
	}
	return toUserResponse(createdUser), nil
}

var dummyHash, _ = bcrypt.GenerateFromPassword(
	[]byte("dummy-password-for-timing-safety"), bcrypt.DefaultCost)

func (s *service) Login(ctx context.Context, req LoginRequest) (*Session, error) {
	req.Password = strings.TrimSpace(req.Password)
	req.Identifier = strings.TrimSpace(req.Identifier)

	if req.Identifier == "" || req.Password == "" {
		return nil, ErrInvalidCredentials
	}
	user, err := s.repo.GetUserByIdentifier(ctx, req.Identifier)
	if err != nil {
		// NOTE: Void comparison to avoid user enumeration
		bcrypt.CompareHashAndPassword(dummyHash, []byte(req.Password))
		return nil, ErrInvalidCredentials
	}

	if err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	sessionID, err := generateSessionID()
	if err != nil {
		return nil, err
	}

	session := &Session{
		ID:        sessionID,
		UserID:    user.ID,
		ExpiresAt: time.Now().Add(24 * 7 * time.Hour),
	}

	return s.repo.CreateSession(ctx, session)
}

func (s *service) GetSession(ctx context.Context, sessionID string) (*UserResponse, error) {
	session, err := s.repo.GetSessionByID(ctx, sessionID)
	if err != nil {
		return nil, err
	}

	if time.Now().After(session.ExpiresAt) {
		_ = s.repo.DeleteSession(ctx, sessionID)
		return nil, ErrSessionExpired
	}

	return toUserResponse(session.User), nil
}

func (s *service) Logout(ctx context.Context, sessionID string) error {
	return s.repo.DeleteSession(ctx, sessionID)
}
