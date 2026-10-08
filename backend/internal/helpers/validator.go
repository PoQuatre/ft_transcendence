// Package helpers gives helper functions for every other packages.
package helpers

import (
	"net/http"
	"regexp"
	"unicode"

	"github.com/go-playground/validator/v10"
	"github.com/labstack/echo/v5"
)

type CustomValidator struct {
	validator *validator.Validate
}

func (cv *CustomValidator) Validate(i any) error {
	if err := cv.validator.Struct(i); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	return nil
}

var usernameRegex = regexp.MustCompile(`^[a-zA-Z0-9_]+$`)

func NewCustomValidator() (*CustomValidator, error) {
	v := validator.New()
	err := v.RegisterValidation("password_complexity", func(fl validator.FieldLevel) bool {
		pass := fl.Field().String()
		var hasNum, hasUpper, hasLower, hasSpecial bool
		for _, r := range pass {
			switch {
			case '0' <= r && r <= '9':
				hasNum = true
			case 'a' <= r && r <= 'z':
				hasLower = true
			case 'A' <= r && r <= 'Z':
				hasUpper = true
			case unicode.IsPunct(r) || unicode.IsSymbol(r):
				hasSpecial = true
			}
		}
		return hasNum && hasUpper && hasLower && hasSpecial
	})
	if err != nil {
		return nil, err
	}
	err = v.RegisterValidation("username_chars", func(fl validator.FieldLevel) bool {
		return usernameRegex.MatchString(fl.Field().String())
	})
	if err != nil {
		return nil, err
	}
	return &CustomValidator{validator: v}, nil
}
