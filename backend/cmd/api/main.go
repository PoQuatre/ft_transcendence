// Package main runs the backend HTTP server.
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/spf13/cobra"
)

func main() {
	root := newRootCmd()

	if err := run(root); err != nil {
		slog.Error("an error occurred", "error", err)
		os.Exit(1)
	}
}

func run(cmd *cobra.Command) error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	return cmd.ExecuteContext(ctx)
}

func newRootCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "api",
		Short: "API server and migration tools",
	}

	cmd.AddCommand(
		newServeCmd(),
		newMigrateCmd(),
	)

	return cmd
}
