package auth

import (
	"context"
	"fmt"

	"github.com/wneessen/go-mail"
)

func SendMail(ctx context.Context, to, from, subj, body string) error {
	_ = ctx
	m := mail.NewMsg()
	if err := m.From(from); err != nil {
		return fmt.Errorf("error 'From': %w", err)
	}
	if err := m.To(to); err != nil {
		return fmt.Errorf("error 'To': %w", err)
	}
	m.Subject(subj)

	// NOTE: Once we have the cool html message, turn this to
	// m.SetBodyString(mail.TypeTextHTML, body)
	m.SetBodyString(mail.TypeTextPlain, body)

	// NOTE: mailpit version (for dev and tests)
	c, err := mail.NewClient("host.containers.internal",
		mail.WithPort(1025),
		mail.WithTLSPortPolicy(mail.NoTLS),
	)
	// Replace block over with smtp version on prod.
	if err != nil {
		return fmt.Errorf("error 'NewClient': %w", err)
	}
	// if err := c.DialAndSendWithContext(context.Background(), m); err != nil {
	if err := c.DialAndSendWithContext(ctx, m); err != nil {
		return fmt.Errorf("failed to send : %w", err)
	}
	return nil
}
