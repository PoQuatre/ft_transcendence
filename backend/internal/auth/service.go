package auth

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

var ErrInvalidCredentials = errors.New("invalid email or password")

type Service interface {
	SignUp(ctx context.Context, req SignupRequest) (*UserResponse, error)
	Login(ctx context.Context, req LoginRequest) (*UserResponse, error)
	GetUserByID(ctx context.Context, id uuid.UUID) (*UserResponse, error)
}

type service struct {
	repo Repository
}

func NewService(repo Repository) Service {
	return &service{repo: repo}
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
	req.Email = strings.ToLower(req.Email)
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

var dummyHash, dummyHashErr = bcrypt.GenerateFromPassword([]byte("dummy-password-for-timing-safety"), bcrypt.DefaultCost)

func dummyCompare(password string) {
	if dummyHashErr != nil || len(dummyHash) == 0 {
		return
	}
	if err := bcrypt.CompareHashAndPassword(dummyHash, []byte(password)); err != nil {
		return
	}
}

func (s *service) Login(ctx context.Context, req LoginRequest) (
	*UserResponse, error,
) {
	req.Password = strings.TrimSpace(req.Password)
	req.Email = strings.TrimSpace(req.Email)
	req.Email = strings.ToLower(req.Email)

	if req.Email == "" || req.Password == "" {
		return nil, ErrInvalidCredentials
	}
	user, err := s.repo.GetUserByEmail(ctx, req.Email)
	if err != nil {
		dummyCompare(req.Password)
		return nil, ErrInvalidCredentials
	}

	if err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	return toUserResponse(user), nil
}

func (s *service) GetUserByID(ctx context.Context, id uuid.UUID) (*UserResponse, error) {
	user, err := s.repo.GetUserByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return toUserResponse(user), nil
}
