package database

import (
	"context"
	"database/sql/driver"
	"errors"
	"net/url"
	"strings"
	"sync/atomic"

	"github.com/uptrace/bun/driver/pgdriver"
)

type connectorState struct {
	connector  *pgdriver.Connector
	generation uint64
}

type Credentials struct {
	User       string
	Password   string
	Generation uint64
}

type CredentialsSource interface {
	DBCredentials() *Credentials
	DBCredentialsChanged() <-chan struct{}
}

type RotatingConnector struct {
	state       atomic.Pointer[connectorState]
	credentials CredentialsSource
	dsnTmpl     string
}

func (c *RotatingConnector) Connect(ctx context.Context) (driver.Conn, error) {
	state := c.state.Load()
	if state == nil {
		return nil, errors.New("database connector not initialized")
	}
	return state.connector.Connect(ctx)
}

func (c *RotatingConnector) Driver() driver.Driver {
	return pgdriver.NewDriver()
}

func (c *RotatingConnector) currentCredentials() (Credentials, error) {
	credentials := c.credentials.DBCredentials()
	if credentials == nil {
		return Credentials{}, errors.New("database credentials not initialized")
	}
	return *credentials, nil
}

func (c *RotatingConnector) rotate(credentials Credentials) {
	current := c.state.Load()
	if current != nil && current.generation == credentials.Generation {
		return
	}

	dsn := strings.ReplaceAll(c.dsnTmpl, "{{user-passwd}}",
		url.UserPassword(credentials.User, credentials.Password).String())

	next := pgdriver.NewConnector(
		pgdriver.WithDSN(dsn),
		pgdriver.WithResetSessionFunc(
			func(ctx context.Context, conn *pgdriver.Conn) error {
				current, err := c.currentCredentials()
				if err != nil || current.Generation != credentials.Generation {
					return driver.ErrBadConn
				}
				return nil
			},
		),
	)

	c.state.Store(&connectorState{
		connector:  next,
		generation: credentials.Generation,
	})
}

func (c *RotatingConnector) watchCredentials(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-c.credentials.DBCredentialsChanged():
			credentials, err := c.currentCredentials()
			if err == nil {
				c.rotate(credentials)
			}
		}
	}
}
