package todos

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
	"github.com/labstack/echo/v5/echotest"
)

func TestHandlerList(t *testing.T) {
	todo := Todo{ID: uuid.New(), Title: "Buy milk"}
	h := handler{service: NewService(&testRepository{listResult: []Todo{todo}})}
	context, response := newHandlerContext(t, http.MethodGet, "", "")

	if err := h.list(context); err != nil {
		t.Fatal(err)
	}
	if response.Code != http.StatusOK {
		t.Fatalf("list() status = %d, want %d", response.Code, http.StatusOK)
	}
	var got []Todo
	decodeJSON(t, response, &got)
	if len(got) != 1 || got[0] != todo {
		t.Errorf("list() response = %+v, want [%+v]", got, todo)
	}
}

func TestHandlerGet(t *testing.T) {
	todo := Todo{ID: uuid.New(), Title: "Buy milk"}
	h := handler{service: NewService(&testRepository{getResult: &todo})}
	context, response := newHandlerContext(t, http.MethodGet, "", todo.ID.String())

	if err := h.get(context); err != nil {
		t.Fatal(err)
	}
	if response.Code != http.StatusOK {
		t.Fatalf("get() status = %d, want %d", response.Code, http.StatusOK)
	}
	var got Todo
	decodeJSON(t, response, &got)
	if got != todo {
		t.Errorf("get() response = %+v, want %+v", got, todo)
	}
}

func TestHandlerCreate(t *testing.T) {
	repository := new(testRepository)
	h := handler{service: NewService(repository)}
	context, response := newHandlerContext(t, http.MethodPost, `{"title":"  Buy milk  "}`, "")

	if err := h.create(context); err != nil {
		t.Fatal(err)
	}
	if response.Code != http.StatusCreated {
		t.Fatalf("create() status = %d, want %d", response.Code, http.StatusCreated)
	}
	var got Todo
	decodeJSON(t, response, &got)
	if got.Title != "Buy milk" || repository.createdTodo.Title != "Buy milk" {
		t.Errorf("create() response = %+v, repository input = %+v, want trimmed title", got, repository.createdTodo)
	}
}

func TestHandlerUpdate(t *testing.T) {
	id := uuid.New()
	repository := new(testRepository)
	h := handler{service: NewService(repository)}
	context, response := newHandlerContext(t, http.MethodPut, `{"title":"Buy oat milk","completed":true}`, id.String())

	if err := h.update(context); err != nil {
		t.Fatal(err)
	}
	if response.Code != http.StatusOK {
		t.Fatalf("update() status = %d, want %d", response.Code, http.StatusOK)
	}
	var got Todo
	decodeJSON(t, response, &got)
	if got.ID != id || got.Title != "Buy oat milk" || !got.Completed {
		t.Errorf("update() response = %+v, want completed todo with ID %s", got, id)
	}
}

func TestHandlerDelete(t *testing.T) {
	id := uuid.New()
	repository := new(testRepository)
	h := handler{service: NewService(repository)}
	context, response := newHandlerContext(t, http.MethodDelete, "", id.String())

	if err := h.delete(context); err != nil {
		t.Fatal(err)
	}
	if response.Code != http.StatusNoContent {
		t.Errorf("delete() status = %d, want %d", response.Code, http.StatusNoContent)
	}
	if repository.deletedID != id {
		t.Errorf("repository.Delete() ID = %s, want %s", repository.deletedID, id)
	}
}

func TestHandlerClientErrors(t *testing.T) {
	missingID := uuid.New().String()
	tests := map[string]struct {
		handler func(handler, *echo.Context) error
		repo    *testRepository
		id      string
		body    string
		message string
		code    int
	}{
		"invalid ID": {
			handler: func(h handler, c *echo.Context) error { return h.get(c) },
			id:      "not-a-uuid",
			code:    http.StatusBadRequest,
			message: "invalid todo ID",
		},
		"malformed JSON": {
			handler: func(h handler, c *echo.Context) error { return h.create(c) },
			body:    `{`,
			code:    http.StatusBadRequest,
			message: "invalid JSON",
		},
		"blank title": {
			handler: func(h handler, c *echo.Context) error { return h.create(c) },
			body:    `{"title":"  "}`,
			code:    http.StatusBadRequest,
			message: "title is required",
		},
		"missing todo on get": {
			handler: func(h handler, c *echo.Context) error { return h.get(c) },
			id:      missingID,
			repo:    &testRepository{getErr: ErrNotFound},
			code:    http.StatusNotFound,
			message: "todo not found",
		},
		"missing todo on update": {
			handler: func(h handler, c *echo.Context) error { return h.update(c) },
			body:    `{"title":"Buy milk","completed":true}`,
			id:      missingID,
			repo:    &testRepository{updateErr: ErrNotFound},
			code:    http.StatusNotFound,
			message: "todo not found",
		},
		"missing todo on delete": {
			handler: func(h handler, c *echo.Context) error { return h.delete(c) },
			id:      missingID,
			repo:    &testRepository{deleteErr: ErrNotFound},
			code:    http.StatusNotFound,
			message: "todo not found",
		},
	}

	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			repository := tt.repo
			if repository == nil {
				repository = new(testRepository)
			}
			context, _ := newHandlerContext(t, http.MethodPost, tt.body, tt.id)
			err := tt.handler(handler{service: NewService(repository)}, context)
			assertHTTPError(t, err, tt.code, tt.message)
		})
	}
}

func newHandlerContext(t *testing.T, method, body, id string) (*echo.Context, *httptest.ResponseRecorder) {
	t.Helper()
	config := echotest.ContextConfig{
		Request: httptest.NewRequestWithContext(t.Context(), method, "/todos", nil),
	}
	if body != "" {
		config.JSONBody = []byte(body)
	}
	if id != "" {
		config.PathValues = echo.PathValues{{Name: "id", Value: id}}
	}
	return config.ToContextRecorder(t)
}

func decodeJSON(t *testing.T, response *httptest.ResponseRecorder, value any) {
	t.Helper()
	if err := json.NewDecoder(response.Body).Decode(value); err != nil {
		t.Fatalf("decode response body %q: %v", response.Body.String(), err)
	}
}

func assertHTTPError(t *testing.T, err error, wantCode int, wantMessage string) {
	t.Helper()
	var got *echo.HTTPError
	if !errors.As(err, &got) {
		t.Fatalf("error = %v, want HTTP error", err)
	}
	if got.Code != wantCode || got.Message != wantMessage {
		t.Errorf("HTTP error = code %d, message %q, want code %d, message %q", got.Code, got.Message, wantCode, wantMessage)
	}
}
