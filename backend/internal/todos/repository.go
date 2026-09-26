package todos

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

var ErrNotFound = errors.New("todo not found")

type Repository interface {
	List(ctx context.Context) ([]Todo, error)
	Get(ctx context.Context, id uuid.UUID) (*Todo, error)
	Create(ctx context.Context, todo Todo) (*Todo, error)
	Update(ctx context.Context, todo Todo) (*Todo, error)
	Delete(ctx context.Context, id uuid.UUID) error
}

type bunRepository struct {
	db *bun.DB
}

func NewRepository(db *bun.DB) Repository {
	return &bunRepository{db: db}
}

func (r *bunRepository) List(ctx context.Context) ([]Todo, error) {
	var todos []Todo
	err := r.db.NewSelect().Model(&todos).OrderBy("created_at", bun.OrderDesc).Scan(ctx)
	return todos, err
}

func (r *bunRepository) Get(ctx context.Context, id uuid.UUID) (*Todo, error) {
	todo := new(Todo)
	if err := r.db.NewSelect().Model(todo).Where("id = ?", id).Scan(ctx); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return todo, nil
}

func (r *bunRepository) Create(ctx context.Context, todo Todo) (*Todo, error) {
	if _, err := r.db.NewInsert().Model(&todo).Exec(ctx); err != nil {
		return nil, err
	}
	return &todo, nil
}

func (r *bunRepository) Update(ctx context.Context, todo Todo) (*Todo, error) {
	result, err := r.db.NewUpdate().Model(&todo).Column("title", "completed").WherePK().Exec(ctx)
	if err != nil {
		return nil, err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return nil, err
	}
	if affected == 0 {
		return nil, ErrNotFound
	}
	return &todo, nil
}

func (r *bunRepository) Delete(ctx context.Context, id uuid.UUID) error {
	result, err := r.db.NewDelete().Model((*Todo)(nil)).Where("id = ?", id).Exec(ctx)
	if err != nil {
		return err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return ErrNotFound
	}
	return nil
}
