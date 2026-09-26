package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"strconv"
	"time"

	"github.com/PoQuatre/ft_transcendence/backend/internal/database"
	"github.com/PoQuatre/ft_transcendence/backend/internal/server"
	"github.com/PoQuatre/ft_transcendence/backend/internal/vault"

	"github.com/spf13/cobra"
)

func newServeCmd() *cobra.Command {
	var (
		port int
		host string
	)

	cmd := &cobra.Command{
		Use:   "serve",
		Short: "Start the API server",
		RunE: func(cmd *cobra.Command, _ []string) error {
			ctx := cmd.Context()

			vaultConfig, err := vault.ConfigFromEnv()
			if err != nil {
				return fmt.Errorf("load Vault configuration: %w", err)
			}
			vaultClient, err := vault.Start(ctx, vaultConfig)
			if err != nil {
				return fmt.Errorf("start Vault client: %w", err)
			}

			db, err := database.NewDB(ctx, vaultClient)
			if err != nil {
				return fmt.Errorf("connect database: %w", err)
			}
			defer func() {
				if err := db.Close(); err != nil {
					slog.Error("close database", "error", err)
				}
			}()

			return serve(ctx, net.JoinHostPort(host, strconv.Itoa(port)),
				server.New(server.WithDatabase(db)))
		},
	}

	cmd.Flags().IntVarP(&port, "port", "p", 8080, "port to listen on")
	cmd.Flags().StringVarP(&host, "host", "H", "0.0.0.0", "host to listen on")

	return cmd
}

func serve(ctx context.Context, addr string, handler http.Handler) error {
	srv := &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		slog.Info("listening", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
			return
		}
		errCh <- nil
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		//nolint:contextcheck // This is desired otherwise the server would
		//                       shutdown instantly without cleaning up
		if err := srv.Shutdown(shutdownCtx); err != nil {
			return fmt.Errorf("shutdown HTTP server: %w", err)
		}

		if err := <-errCh; !errors.Is(err, http.ErrServerClosed) {
			return err
		}

		return nil
	}
}
