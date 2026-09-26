package vault

import (
	"context"
	"fmt"
	"log/slog"
	"sync/atomic"
	"time"

	"github.com/PoQuatre/ft_transcendence/backend/internal/database"

	"github.com/hashicorp/vault/api"
	"github.com/hashicorp/vault/api/auth/approle"
)

const retryInterval = 10 * time.Second

type Client struct {
	api             *api.Client
	database        atomic.Pointer[database.Credentials]
	databaseChanged chan struct{}
	config          Config
}

func (c *Client) DBCredentials() *database.Credentials {
	return c.database.Load()
}

func (c *Client) DBCredentialsChanged() <-chan struct{} {
	return c.databaseChanged
}

func (c *Client) login(ctx context.Context) (*api.Secret, error) {
	auth, err := approle.NewAppRoleAuth(c.config.RoleID, &approle.SecretID{FromFile: c.config.SecretIDPath})
	if err != nil {
		return nil, fmt.Errorf("config vault approle auth: %w", err)
	}
	secret, err := c.api.Auth().Login(ctx, auth)
	if err != nil {
		return nil, fmt.Errorf("auth with vault: %w", err)
	}
	if secret == nil || secret.Auth == nil || secret.Auth.ClientToken == "" {
		return nil, ErrNoClientToken
	}
	return secret, nil
}

func (c *Client) reload(ctx context.Context) error {
	secret, err := c.api.Logical().ReadWithContext(ctx, c.config.DBCredsPath)
	if err != nil {
		return fmt.Errorf("read vault database credentials: %w", err)
	}

	database, err := databaseFrom(secret.Data)
	if err != nil {
		return err
	}

	current := c.database.Load()
	if current != nil {
		if current.User == database.User && current.Password == database.Password {
			return nil
		}
		database.Generation = current.Generation + 1
	} else {
		database.Generation = 1
	}
	c.database.Store(&database)
	select {
	case c.databaseChanged <- struct{}{}:
	default:
	}
	return nil
}

func databaseFrom(data map[string]any) (database.Credentials, error) {
	get := func(key string) (string, error) {
		val, ok := data[key].(string)
		if !ok || val == "" {
			return "", fmt.Errorf("vault database secret has no %q value", key)
		}
		return val, nil
	}

	user, err := get("username")
	if err != nil {
		return database.Credentials{}, err
	}
	password, err := get("password")
	if err != nil {
		return database.Credentials{}, err
	}
	return database.Credentials{User: user, Password: password}, nil
}

func (c *Client) renew(ctx context.Context, secret *api.Secret) {
	for {
		watcher, err := c.api.NewLifetimeWatcher(&api.LifetimeWatcherInput{Secret: secret})
		if err != nil {
			slog.Warn("create vault token renewer", "error", err)
		} else {
			go watcher.Start()
			if !c.watch(ctx, watcher) {
				return
			}
		}

		for {
			if !wait(ctx, retryInterval) {
				return
			}
			secret, err = c.login(ctx)
			if err != nil {
				slog.Warn("reauth with vault", "error", err)
				continue
			}
			if err := c.reload(ctx); err != nil {
				slog.Warn("reload vault database secret", "error", err)
			}
			break
		}
	}
}

func (c *Client) watch(ctx context.Context, watcher *api.LifetimeWatcher) bool {
	defer watcher.Stop()
	for {
		select {
		case <-ctx.Done():
			return false

		case _, ok := <-watcher.RenewCh():
			if !ok {
				return true
			}
			if err := c.reload(ctx); err != nil {
				slog.Warn("reload vault database secret", "error", err)
			}

		case err := <-watcher.DoneCh():
			if err != nil {
				slog.Warn("vault token renewal stopped", "error", err)
			} else {
				slog.Warn("vault token renewal stopped")
			}
			return true
		}
	}
}

func wait(ctx context.Context, duration time.Duration) bool {
	timer := time.NewTimer(duration)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return false

	case <-timer.C:
		return true
	}
}
