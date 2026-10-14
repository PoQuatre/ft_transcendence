package auth

import (
	"context"
	"fmt"

	"github.com/wneessen/go-mail"
)

func SendMail(to, from, subj, body string) error {
	m := mail.NewMsg()
	if err := m.From(from); err != nil {
		return fmt.Errorf("error 'From': %w", err)
	}
	if err := m.To(to); err != nil {
		return fmt.Errorf("error 'From': %w", err)
	}
	m.Subject(subj)
	m.SetBodyString(mail.TypeTextPlain, body)

	// NOTE: mailpit version (for dev and tests ig)
	c, err := mail.NewClient("localhost",
		mail.WithPort(1025),
		mail.WithTLSPortPolicy(mail.NoTLS),
	)
	// NOTE: smtp version for prod ?
	// c, err := mail.NewClient("smpt.example.com",
	// mail.WithUsername("User"),
	// mail.WithPassword("Pass"),
	// mail.WithTLSPortPolicy(mail.TLSMandatory),
	// )
	if err != nil {
		return fmt.Errorf("error 'NewClient': %w", err)
	}
	if err := c.DialAndSendWithContext(context.Background(), m); err != nil {
		return fmt.Errorf("failed to send : %w", err)
	}
	return nil
}
