// Package database initializes Bun for use in repositories.
package database

import (
	"context"
	"database/sql"
	"errors"
	"os"
	"time"

	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
)

func NewDB(ctx context.Context, credentials CredentialsSource) (*bun.DB, error) {
	dsn := os.Getenv("DATABASE_DSN")
	if dsn == "" {
		return nil, errors.New("DATABASE_DSN is empty or unset")
	}
	if credentials == nil {
		return nil, errors.New("database credentials source is required")
	}

	connector := &RotatingConnector{
		credentials: credentials,
		dsnTmpl:     dsn,
	}
	initialCredentials, err := connector.currentCredentials()
	if err != nil {
		return nil, err
	}
	connector.rotate(initialCredentials)

	sqlDB := sql.OpenDB(connector)

	sqlDB.SetMaxOpenConns(25)
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetConnMaxIdleTime(5 * time.Minute)
	sqlDB.SetConnMaxLifetime(30 * time.Minute)

	db := bun.NewDB(sqlDB, pgdialect.New())

	if err := db.PingContext(ctx); err != nil {
		//nolint:errcheck // There already is an error in flight
		_ = db.Close()
		return nil, err
	}

	go connector.watchCredentials(ctx)

	return db, nil
}
