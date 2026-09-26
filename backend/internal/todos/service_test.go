package todos

import (
	"errors"
	"testing"

	"github.com/google/uuid"
)

func TestServiceCreateTrimsAndForwardsTitle(t *testing.T) {
	repository := new(testRepository)
	service := NewService(repository)

	todo, err := service.Create(t.Context(), CreateInput{Title: "  Buy milk  "})
	if err != nil {
		t.Fatal(err)
	}
	if todo.Title != "Buy milk" {
		t.Errorf("Create() title = %q, want %q", todo.Title, "Buy milk")
	}
	if repository.createdTodo.Title != "Buy milk" {
		t.Errorf("repository.Create() title = %q, want %q", repository.createdTodo.Title, "Buy milk")
	}
}

func TestServiceUpdateTrimsAndForwardsInput(t *testing.T) {
	repository := new(testRepository)
	service := NewService(repository)
	id := uuid.New()

	todo, err := service.Update(t.Context(), id, UpdateInput{Title: "  Write tests  ", Completed: true})
	if err != nil {
		t.Fatal(err)
	}
	if todo.ID != id || todo.Title != "Write tests" || !todo.Completed {
		t.Errorf("Update() = %+v, want trimmed, completed todo with ID %s", todo, id)
	}
	if repository.updatedTodo.ID != id || repository.updatedTodo.Title != "Write tests" || !repository.updatedTodo.Completed {
		t.Errorf("repository.Update() = %+v, want trimmed, completed todo with ID %s", repository.updatedTodo, id)
	}
}

func TestServiceRejectsBlankTitles(t *testing.T) {
	tests := map[string]func(*Service) error{
		"create": func(service *Service) error {
			_, err := service.Create(t.Context(), CreateInput{Title: " \t "})
			return err
		},
		"update": func(service *Service) error {
			_, err := service.Update(t.Context(), uuid.New(), UpdateInput{Title: "\n"})
			return err
		},
	}

	for name, call := range tests {
		t.Run(name, func(t *testing.T) {
			repository := new(testRepository)
			if err := call(NewService(repository)); !errors.Is(err, ErrInvalidTitle) {
				t.Errorf("error = %v, want ErrInvalidTitle", err)
			}
			if repository.createdTodo != (Todo{}) || repository.updatedTodo != (Todo{}) {
				t.Error("service called the repository for an invalid title")
			}
		})
	}
}
