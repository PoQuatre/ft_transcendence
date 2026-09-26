package todos

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
)

var ErrInvalidTitle = errors.New("title is required")

type Service struct {
	repository Repository
}

func NewService(repository Repository) *Service {
	return &Service{repository: repository}
}

func (s *Service) List(ctx context.Context) ([]Todo, error) {
	return s.repository.List(ctx)
}

func (s *Service) Get(ctx context.Context, id uuid.UUID) (*Todo, error) {
	return s.repository.Get(ctx, id)
}

func (s *Service) Delete(ctx context.Context, id uuid.UUID) error {
	return s.repository.Delete(ctx, id)
}

func (s *Service) Create(ctx context.Context, input CreateInput) (*Todo, error) {
	title, err := validTitle(input.Title)
	if err != nil {
		return nil, err
	}
	return s.repository.Create(ctx, Todo{Title: title})
}

func (s *Service) Update(ctx context.Context, id uuid.UUID, input UpdateInput) (*Todo, error) {
	title, err := validTitle(input.Title)
	if err != nil {
		return nil, err
	}
	return s.repository.Update(ctx, Todo{
		ID:        id,
		Title:     title,
		Completed: input.Completed,
	})
}

func validTitle(title string) (string, error) {
	title = strings.TrimSpace(title)
	if title == "" {
		return "", ErrInvalidTitle
	}
	return title, nil
}
