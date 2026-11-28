package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	_ "embed"
	"encoding/hex"
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
	repo      Repository
	keyLimits rateLimiter
	ipLimits  rateLimiter
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo, keyLimits: rateLimiter{now: time.Now}, ipLimits: rateLimiter{now: time.Now}}
}

func generateSecret() (string, error) {
	var random [32]byte
	if _, err := rand.Read(random[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(random[:]), nil
}

func hashSecret(secret string) string {
	hash := sha256.Sum256([]byte(secret))
	return hex.EncodeToString(hash[:])
}

func (s *Service) CreateAPIKey(ctx context.Context, id uuid.UUID) (*APIKey, string, error) {
	secret, err := generateSecret()
	if err != nil {
		return nil, "", err
	}
	key := &APIKey{UserID: id, KeyHash: hashSecret(secret), Prefix: secret[:8], CreatedAt: time.Now().UTC()}
	if err := s.repo.SaveAPIKey(ctx, key); err != nil {
		return nil, "", err
	}
	return key, secret, nil
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

//go:embed passwordMail.html
var passwordMailTemplate string

//go:embed verifMail.html
var verifMailTemplate string

//go:embed deleteMail.html
var deleteMailTemplate string

//go:embed exportMail.html
var exportMailTemplate string

func createForgotPasswordMail(resetURL string) string {
	strRep := fmt.Sprintf(passwordMailTemplate, resetURL, resetURL, resetURL)
	return strRep
}

func createMailVerificationMail(code string) string {
	strRep := fmt.Sprintf(verifMailTemplate, code, code)
	return strRep
}

func createDeleteMail(username string) string {
	utcTime := time.Now().UTC().Format("02-01-2006 15:04:05")
	strRep := fmt.Sprintf(deleteMailTemplate, username, utcTime)
	return strRep
}

func createExportMail(username string) string {
	utcTime := time.Now().UTC().Format("02-01-2006 15:04:05")
	strRep := fmt.Sprintf(exportMailTemplate, username, utcTime)
	return strRep
}

func (s *Service) SendExportMail(ctx context.Context, user *User) error {
	if os.Getenv("HOSTNAME") == "" {
		return echo.NewHTTPError(http.StatusInternalServerError, "mails are disabled")
	}
	mailContent := createExportMail(user.Username)
	if err := SendMail(ctx, user.Email, "transcendence@transcendence.com", "Data Export - ft_transcendence", mailContent); err != nil {
		return err
	}
	return nil
}

func (s *Service) SendDeleteMail(ctx context.Context, user *User) error {
	if os.Getenv("HOSTNAME") == "" {
		return echo.NewHTTPError(http.StatusInternalServerError, "mails are disabled")
	}
	mailContent := createDeleteMail(user.Username)
	if err := SendMail(ctx, user.Email, "transcendence@transcendence.com", "Delete Account - ft_transcendence", mailContent); err != nil {
		return err
	}
	return nil
}

func (s *Service) SendForgotPasswordMail(ctx context.Context, user *User) error {
	if os.Getenv("HOSTNAME") == "" {
		return echo.NewHTTPError(http.StatusInternalServerError, "mails are disabled")
	}

	rawToken, err := generateSecret()
	if err != nil {
		return err
	}

	reset := &PasswordResetToken{
		UserID:    user.ID,
		TokenHash: hashSecret(rawToken),
		ExpiresAt: time.Now().Add(15 * time.Minute),
	}
	if _, err := s.repo.CreatePasswordResetToken(ctx, reset); err != nil {
		return err
	}

	resetURL := "https://localhost:8443/reset-password?token=" + rawToken
	mailContent := createForgotPasswordMail(resetURL)

	// remplacer transcendence@transcendence par le vrai mail une fois quon a un mail bien setup
	if err := SendMail(ctx, user.Email, "transcendence@transcendence.com", "Forgot Password - ft_transcendence", mailContent); err != nil {
		return err
	}
	return nil
}

func (s *Service) ResetPasswordWithToken(ctx context.Context, rawToken, newPassword string) error {
	resetToken, err := s.repo.GetPasswordResetToken(ctx, hashSecret(rawToken))
	if err != nil {
		return errors.New("invalid or expired token")
	}
	if time.Now().After(resetToken.ExpiresAt) {
		err = s.repo.DeletePasswordResetToken(ctx, resetToken.ID)
		if err != nil {
			return errors.New("token expired, failed to delete it")
		}
		return errors.New("token expired")
	}

	user, err := s.repo.GetUserByID(ctx, resetToken.UserID)
	if err != nil {
		return err
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	if _, err := s.repo.SetNewPasswordToUser(ctx, user, string(hashedPassword)); err != nil {
		return err
	}
	return s.repo.DeletePasswordResetToken(ctx, resetToken.ID)
}

func (s *Service) ChangeUserPassword(ctx context.Context, userID uuid.UUID, oldPassword, password string) error {
	user, err := s.repo.GetUserByID(ctx, userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "found no corresponding user")
	}
	if err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(oldPassword)); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid password")
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

func generateCodeForMailVerif() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(900000))
	if err != nil {
		return "", fmt.Errorf("failed to generate random code: %w", err)
	}

	code := int(n.Int64()) + 100000
	codeStr := strconv.Itoa(code)

	return codeStr, nil
}

func (s *Service) SendVerificationEmail(ctx context.Context, userID uuid.UUID, email string) error {
	if os.Getenv("HOSTNAME") == "" {
		return s.repo.MarkEmailAsVerified(ctx, userID)
	}

	code, err := generateCodeForMailVerif()
	if err != nil {
		return err
	}
	userVerif := &UserVerify{
		UserID: userID,
		Code:   code,
	}

	mailContent := createMailVerificationMail(code)
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
	req.Username = strings.TrimSpace(strings.ToLower(req.Username))
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

func (s *Service) GetUserByUsername(ctx context.Context, username string) (*User, error) {
	username = strings.TrimSpace(strings.ToLower(username))
	return s.repo.GetUserByUsername(ctx, username)
}

func (s *Service) GetUserByEmail(ctx context.Context, email string) (*User, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	return s.repo.GetUserByEmail(ctx, email)
}

func (s *Service) DeleteAccount(ctx context.Context, userID uuid.UUID, password string) error {
	passwordHash, err := s.repo.GetUserPasswordHash(ctx, userID)
	if err != nil {
		return err
	}
	if err = bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(password)); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid password")
	}
	user, err := s.repo.GetUserByID(ctx, userID)
	if err != nil {
		return err
	}
	err = s.repo.DeleteEmailVerifToken(ctx, userID)
	if err != nil {
		return err
	}
	err = s.repo.DeletePasswordTokenFromUserID(ctx, userID)
	if err != nil {
		return err
	}
	err = s.repo.DeleteFriendRequestsWithUserID(ctx, userID)
	if err != nil {
		return err
	}
	err = s.repo.DeleteFriendRelationsWithUserID(ctx, userID)
	if err != nil {
		return err
	}
	err = s.repo.DeleteFriendMessagesFromUserID(ctx, userID)
	if err != nil {
		return err
	}
	err = s.repo.DeleteAPIKey(ctx, userID)
	if err != nil {
		return err
	}
	err = s.repo.DeleteUser(ctx, userID)
	if err != nil {
		return err
	}
	return s.SendDeleteMail(ctx, user)
}

func (s *Service) UpdateProfile(ctx context.Context, userID uuid.UUID, email, username string) error {
	user, err := s.GetUserByID(ctx, userID)
	if err != nil {
		return err
	}
	email = strings.TrimSpace(strings.ToLower(email))
	username = strings.TrimSpace(strings.ToLower(username))
	if email != "" && user.Email != email {
		// Checks that the email is not already used.
		_, err = s.repo.GetUserByEmail(ctx, email)
		if err != nil && !errors.Is(err, ErrNotFound) {
			return err
		} else if err == nil {
			return ErrEmailAlreadyExists
		}

		err = s.repo.UpdateEmail(ctx, userID, email)
		if err != nil {
			return err
		}
	}
	if username != "" && user.Username != username {
		// Checks that the username is not already used.
		_, err = s.repo.GetUserByUsername(ctx, username)
		if err != nil && !errors.Is(err, ErrNotFound) {
			return err
		} else if err == nil {
			return ErrUsernameAlreadyExists
		}

		err = s.repo.UpdateUsername(ctx, userID, username)
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) GetDataFromUser(ctx context.Context, userID uuid.UUID) (*DataExport, error) {
	user, err := s.repo.GetUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	friendList, err := s.repo.GetFriendListFromUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	friendRequestsSent, err := s.repo.GetFriendRequestsFromUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	friendRequestsReceived, err := s.repo.GetFriendRequestsToUserID(ctx, userID)
	if err != nil {
		return nil, err
	}

	friendMessages, err := s.repo.GetMessagesFromUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	err = s.SendExportMail(ctx, user)
	if err != nil {
		return nil, err
	}
	userData := new(DataExport)
	userData.Email = user.Email
	userData.Username = user.Username
	userData.ID = user.ID.String()
	userData.Verified = user.Verified
	userData.Friends = friendList
	userData.FriendRequestsSent = friendRequestsSent
	userData.FriendRequestsReceived = friendRequestsReceived
	userData.Messages = friendMessages
	return userData, nil
}
