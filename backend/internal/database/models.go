package database

import (
	"github.com/PoQuatre/ft_transcendence/backend/internal/auth"
)

func Models() []any {
	return []any{
		(*auth.User)(nil),
		(*auth.Session)(nil),
	}
}
