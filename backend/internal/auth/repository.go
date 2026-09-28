package auth

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

var (
	ErrNotFound      = errors.New("user not found")
	ErrAlreadyExists = errors.New("email already taken")
)

type Repository interface {
	// Users
	CreateUser(ctx context.Context, user *User) (*User, error)
	GetUserByEmail(ctx context.Context, email string) (*User, error)
	GetUserByID(ctx context.Context, id uuid.UUID) (*User, error)
	GetUserByIdentifier(ctx context.Context, identifier string) (*User, error)

	// Sessions
	CreateSession(ctx context.Context, session *Session) (*Session, error)
	GetSessionByID(ctx context.Context, sessionID string) (*Session, error)
	DeleteSession(ctx context.Context, sessionID string) error
}

type bunRepository struct {
	db *bun.DB
}

func NewRepository(db *bun.DB) Repository {
	return &bunRepository{db: db}
}

func (r *bunRepository) CreateUser(ctx context.Context, user *User) (*User, error) {
	if _, err := r.db.NewInsert().Model(user).Exec(ctx); err != nil {
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

func (r *bunRepository) GetUserByIdentifier(ctx context.Context, identifier string) (*User, error) {
	user := new(User)
	err := r.db.NewSelect().
		Model(user).
		Where("email = ? OR username = ?", identifier, identifier).
		Scan(ctx)
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

// Implémentation des sessions avec Bun
func (r *bunRepository) CreateSession(ctx context.Context, session *Session) (*Session, error) {
	if _, err := r.db.NewInsert().Model(session).Exec(ctx); err != nil {
		return nil, err
	}
	return session, nil
}

func (r *bunRepository) GetSessionByID(ctx context.Context, sessionID string) (*Session, error) {
	session := new(Session)
	// On joint directement l'utilisateur associé
	err := r.db.NewSelect().
		Model(session).
		Relation("User").
		Where("s.id = ?", sessionID).
		Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return session, nil
}

func (r *bunRepository) DeleteSession(ctx context.Context, sessionID string) error {
	_, err := r.db.NewDelete().Model((*Session)(nil)).Where("id = ?", sessionID).Exec(ctx)
	return err
}
