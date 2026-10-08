package helpers

import (
	"errors"
	"net/http"
	"testing"

	"github.com/labstack/echo/v5"
)

type sampleStruct struct {
	Username string `validate:"required,min=3,username_chars"`
	Password string `validate:"required,password_complexity"`
}

func TestNewCustomValidator(t *testing.T) {
	cv, err := NewCustomValidator()
	if err != nil {
		t.Fatalf("failed to instantiate CustomValidator: %v", err)
	}
	if cv == nil {
		t.Fatal("expected non-nil CustomValidator")
	}
}

func TestCustomValidator_Validate_PasswordComplexity(t *testing.T) {
	cv, err := NewCustomValidator()
	if err != nil {
		t.Fatalf("setup validator failed: %v", err)
	}

	tests := []struct {
		name     string
		password string
		wantErr  bool
	}{
		{
			name:     "valid complex password",
			password: "Password123!",
			wantErr:  false,
		},
		{
			name:     "missing digit",
			password: "Password!",
			wantErr:  true,
		},
		{
			name:     "missing uppercase",
			password: "password123!",
			wantErr:  true,
		},
		{
			name:     "missing lowercase",
			password: "PASSWORD123!",
			wantErr:  true,
		},
		{
			name:     "missing special char",
			password: "Password123",
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := sampleStruct{
				Username: "valid_user",
				Password: tt.password,
			}

			err := cv.Validate(s)
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}

			if tt.wantErr && err != nil {
				var httpErr *echo.HTTPError
				if errors.As(err, &httpErr) {
					if httpErr.Code != http.StatusBadRequest {
						t.Errorf("expected status 400 Bad Request, got %d", httpErr.Code)
					}
				} else {
					t.Errorf("expected error to be *echo.HTTPError, got %T", err)
				}
			}
		})
	}
}

func TestCustomValidator_Validate_UsernameChars(t *testing.T) {
	cv, err := NewCustomValidator()
	if err != nil {
		t.Fatalf("setup validator failed: %v", err)
	}

	tests := []struct {
		name     string
		username string
		wantErr  bool
	}{
		{
			name:     "valid alphanumeric username",
			username: "john_doe123",
			wantErr:  false,
		},
		{
			name:     "valid uppercase and underscores",
			username: "John_Doe_99",
			wantErr:  false,
		},
		{
			name:     "invalid space in username",
			username: "john doe",
			wantErr:  true,
		},
		{
			name:     "invalid hyphen in username",
			username: "john-doe",
			wantErr:  true,
		},
		{
			name:     "invalid special character @",
			username: "john@doe",
			wantErr:  true,
		},
		{
			name:     "too short username",
			username: "ab",
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := sampleStruct{
				Username: tt.username,
				Password: "ValidPassword123!",
			}

			err := cv.Validate(s)
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
