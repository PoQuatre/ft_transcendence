package auth

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
	"golang.org/x/crypto/bcrypt"
)

var ErrInvalidCredentials = errors.New("invalid email or password")

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func toUserResponse(user *User) *UserResponse {
	if user == nil {
		return nil
	}
	return &UserResponse{
		ID:       user.ID.String(),
		Username: user.Username,
		Email:    user.Email,
		Verified: user.Verified,
	}
}

func (s *Service) ChangeUserPassword(ctx context.Context, userID uuid.UUID, password string) error {
	user, err := s.repo.GetUserByID(ctx, userID)
	if err != nil {
		return err
	}
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	if _, err = s.repo.SetNewPasswordToUser(ctx, user, string(hashedPassword)); err != nil {
		return err
	}
	return nil
}

func (s *Service) CheckVerificationEmail(ctx context.Context, userID uuid.UUID, code string) error {
	user, err := s.repo.GetUserVerificationByID(ctx, userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "user does not exist")
	}
	if user.EndsAt.Before(time.Now()) {
		return echo.NewHTTPError(http.StatusBadRequest, "timeout")
	}
	if user.Code != code {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid code")
	}
	if err := s.repo.MarkEmailAsVerified(ctx, userID); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	return nil
}

// TODO: Turn to a cool html message.
func createMail(code string) string {
	rep := "Hello,\n\nThank you for signing up with ft_transcendence.\n\nHere is your verification code to enter on the authentication page:\n["
	rep += code
	rep += "]\nThis code is valid for 10 minutes. If you did not request this code, you can safely ignore this email.\n\nBest regards,\nThe ft_transcendence Team"
	return rep
}

func generateCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(900000))
	if err != nil {
		return "", fmt.Errorf("failed to generate random code: %w", err)
	}

	code := int(n.Int64()) + 100000
	codeStr := strconv.Itoa(code)

	return codeStr, nil
}

func (s *Service) SendVerificationEmail(ctx context.Context, userID uuid.UUID, email string) error {
	if os.Getenv("ENABLE_EMAILS") != "true" {
		fmt.Println("ENABLE_EMAILS = `" + os.Getenv("ENABLE_EMAILS") + "`")
		return s.repo.MarkEmailAsVerified(ctx, userID)
	}

	code, err := generateCode()
	if err != nil {
		return err
	}
	userVerif := &UserVerify{
		UserID: userID,
		Code:   code,
	}

	mailContent := createMail(code)
	if _, err = s.repo.CreateUserVerification(ctx, userVerif); err != nil {
		return err
	}
	// remplacer transcendence@transcendence par le vrai mail une fois quon a un mail bien setup
	if err := SendMail(ctx, email, "transcendence@transcendence.com", "Your verification code - ft_transcendence", mailContent); err != nil {
		return err
	}

	return nil
}

func (s *Service) SignUp(ctx context.Context, req SignupRequest) (*UserResponse, error) {
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
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

func (s *Service) Login(ctx context.Context, req LoginRequest) (
	*UserResponse, error,
) {
	req.Password = strings.TrimSpace(req.Password)
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

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

func (s *Service) GetUserByID(ctx context.Context, id uuid.UUID) (*UserResponse, error) {
	user, err := s.repo.GetUserByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return toUserResponse(user), nil
}
