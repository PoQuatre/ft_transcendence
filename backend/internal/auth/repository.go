package auth

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/driver/pgdriver"
)

var (
	ErrNotFound              = errors.New("user not found")
	ErrSessionNotFound       = errors.New("session not found")
	ErrAlreadyExists         = errors.New("email or username already used")
	ErrUsernameAlreadyExists = errors.New("username already used")
	ErrEmailAlreadyExists    = errors.New("email already used")
)

type Repository interface {
	CreateUser(ctx context.Context, user *User) (*User, error)
	GetUserByEmail(ctx context.Context, email string) (*User, error)
	GetUserByID(ctx context.Context, id uuid.UUID) (*User, error)
	SetNewPasswordToUser(ctx context.Context, user *User, passwordhash string) (*User, error)

	GetUserVerificationByID(ctx context.Context, id uuid.UUID) (*UserVerify, error)
	CreateUserVerification(ctx context.Context, user *UserVerify) (*UserVerify, error)

	MarkEmailAsVerified(ctx context.Context, UserID uuid.UUID) error

	CreatePasswordResetToken(ctx context.Context, reset *PasswordResetToken) (*PasswordResetToken, error)
	GetPasswordResetToken(ctx context.Context, tokenHash string) (*PasswordResetToken, error)
	DeletePasswordResetToken(ctx context.Context, tokenID uuid.UUID) error
}

type bunRepository struct {
	db *bun.DB
}

func NewRepository(db *bun.DB) Repository {
	return &bunRepository{db: db}
}

func (r *bunRepository) GetPasswordResetToken(ctx context.Context, tokenHash string) (*PasswordResetToken, error) {
	token := new(PasswordResetToken)

	err := r.db.NewSelect().
		Model(token).
		Where("token_hash = ?", tokenHash).
		Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("password reset token not found: %w", err)
		}
		return nil, fmt.Errorf("failed to fetch password reset token: %w", err)
	}

	return token, nil
}

func (r *bunRepository) DeletePasswordResetToken(ctx context.Context, tokenID uuid.UUID) error {
	token := &PasswordResetToken{ID: tokenID}

	_, err := r.db.NewDelete().
		Model(token).
		WherePK().
		Returning("*").
		Exec(ctx)
	if err != nil {
		return fmt.Errorf("failed to delete password reset token: %w", err)
	}

	return nil
}

func (r *bunRepository) CreatePasswordResetToken(ctx context.Context, reset *PasswordResetToken) (*PasswordResetToken, error) {
	_, err := r.db.NewDelete().
		Model((*PasswordResetToken)(nil)).
		Where("user_id = ?", reset.UserID).
		Exec(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to clean up old reset tokens: %w", err)
	}

	_, err = r.db.NewInsert().
		Model(reset).
		Exec(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to insert password reset token: %w", err)
	}
	return reset, nil
}

func (r *bunRepository) MarkEmailAsVerified(ctx context.Context, userID uuid.UUID) error {
	res, err := r.db.NewUpdate().
		Model((*User)(nil)).
		Set("verified = ?", true).
		Where("id = ?", userID).
		Exec(ctx)
	if err != nil {
		return fmt.Errorf("mark email as verified: %w", err)
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return ErrNotFound
	}

	return nil
}

func (r *bunRepository) CreateUser(ctx context.Context, user *User) (*User, error) {
	if _, err := r.db.NewInsert().Model(user).Exec(ctx); err != nil {
		var pgErr pgdriver.Error
		if errors.As(err, &pgErr) && pgErr.Field('C') == "23505" {
			detail := pgErr.Field('D')
			switch {
			case strings.Contains(detail, "username"):
				return nil, ErrUsernameAlreadyExists
			case strings.Contains(detail, "email"):
				return nil, ErrEmailAlreadyExists
			default:
				return nil, ErrAlreadyExists
			}
		}
		return nil, err
	}
	return user, nil
}

func (r *bunRepository) SetNewPasswordToUser(ctx context.Context, user *User, passwordhash string) (*User, error) {
	user.PasswordHash = passwordhash
	_, err := r.db.NewUpdate().
		Model(user).
		Column("password_hash").
		WherePK().
		Exec(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to update user password in database: %w", err)
	}
	return user, nil
}

func (r *bunRepository) CreateUserVerification(ctx context.Context, user *UserVerify) (*UserVerify, error) {
	_, err := r.db.NewInsert().
		Model(user).
		On("CONFLICT (user_id) DO UPDATE").
		Set("code = EXCLUDED.code").
		Set("ends_at = EXCLUDED.ends_at").
		Returning("*").
		Exec(ctx)
	if err != nil {
		return nil, err
	}
	return user, nil
}

func (r *bunRepository) GetUserVerificationByID(ctx context.Context, id uuid.UUID) (*UserVerify, error) {
	user := new(UserVerify)
	err := r.db.NewSelect().Model(user).Where("user_id = ?", id).Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return user, nil
}

func (r *bunRepository) GetUserByEmail(ctx context.Context, email string) (*User, error) {
	user := new(User)
	err := r.db.NewSelect().Model(user).Where("email = ?", email).Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return user, nil
}

func (r *bunRepository) GetUserByID(ctx context.Context, id uuid.UUID) (*User, error) {
	user := new(User)
	err := r.db.NewSelect().Model(user).Where("id = ?", id).Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return user, nil
}
