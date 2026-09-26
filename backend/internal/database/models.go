package database

import (
	"github.com/PoQuatre/ft_transcendence/backend/internal/todos"
)

func Models() []any {
	return []any{
		(*todos.Todo)(nil),
	}
}
