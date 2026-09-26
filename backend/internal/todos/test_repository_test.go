package todos

import (
	"context"

	"github.com/google/uuid"
)

// testRepository records calls made through the service without requiring a database.
type testRepository struct {
	listResult []Todo
	getResult  *Todo
	getErr     error
	updateErr  error
	deleteErr  error

	createdTodo Todo
	updatedTodo Todo
	deletedID   uuid.UUID
}

func (r *testRepository) List(context.Context) ([]Todo, error) {
	return r.listResult, nil
}

func (r *testRepository) Get(_ context.Context, id uuid.UUID) (*Todo, error) {
	return r.getResult, r.getErr
}

func (r *testRepository) Create(_ context.Context, todo Todo) (*Todo, error) {
	r.createdTodo = todo
	return &todo, nil
}

func (r *testRepository) Update(_ context.Context, todo Todo) (*Todo, error) {
	r.updatedTodo = todo
	if r.updateErr != nil {
		return nil, r.updateErr
	}
	return &todo, nil
}

func (r *testRepository) Delete(_ context.Context, id uuid.UUID) error {
	r.deletedID = id
	return r.deleteErr
}
