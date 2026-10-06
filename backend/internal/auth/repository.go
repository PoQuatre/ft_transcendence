package auth

import (
	"context"
	"database/sql"
	"errors"
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
}

type bunRepository struct {
	db *bun.DB
}

func NewRepository(db *bun.DB) Repository {
	return &bunRepository{db: db}
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
