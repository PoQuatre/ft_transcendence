package friends

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
)

type messageRepository struct {
	Repository
	saved bool
	err   error
}

func (r *messageRepository) AreFriend(context.Context, uuid.UUID, uuid.UUID) (bool, error) {
	return true, nil
}

func (r *messageRepository) CreateFriendMessage(context.Context, uuid.UUID, uuid.UUID, string) error {
	r.saved = r.err == nil
	return r.err
}

func TestSendMessageSavesBeforeNotifying(t *testing.T) {
	sender, recipient := uuid.New(), uuid.New()
	repo := &messageRepository{}
	notified := false
	service := NewService(repo, func(gotRecipient, gotSender uuid.UUID, message string) {
		notified = true
		if !repo.saved || gotRecipient != recipient || gotSender != sender || message != "hello" {
			t.Error("notification sent before saving or with incorrect contents")
		}
	})

	if err := service.SendMessageToFriend(t.Context(), sender, recipient, "hello"); err != nil {
		t.Fatal(err)
	}
	if !notified {
		t.Fatal("message was not notified")
	}

	repo.saved = false
	repo.err = errors.New("save failed")
	notified = false
	if err := service.SendMessageToFriend(t.Context(), sender, recipient, "hello"); !errors.Is(err, repo.err) {
		t.Fatalf("got error %v, want %v", err, repo.err)
	}
	if notified {
		t.Fatal("notification sent after save failed")
	}
}
