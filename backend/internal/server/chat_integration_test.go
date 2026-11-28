package server

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	pion "github.com/pion/webrtc/v4"

	"github.com/PoQuatre/ft_transcendence/backend/internal/game/webrtc"
)

func TestPrivateMessageDelivery(t *testing.T) {
	db := integrationDB(t, "chat")
	sender, recipient := uuid.New(), uuid.New()
	if _, execErr := db.ExecContext(t.Context(), `INSERT INTO users (id, username, email, password_hash, verified) VALUES (?, 'alice', 'alice@example.com', 'x', true), (?, 'bob', 'bob@example.com', 'x', true)`, sender, recipient); execErr != nil {
		t.Fatal(execErr)
	}
	if _, execErr := db.ExecContext(t.Context(), `INSERT INTO friend_relations (user_id, friend_id) VALUES (?, ?)`, sender, recipient); execErr != nil {
		t.Fatal(execErr)
	}
	sessions, err := newSessionManager(db)
	if err != nil {
		t.Fatal(err)
	}
	cookie := func(id uuid.UUID) *http.Cookie {
		ctx, loadErr := sessions.Load(t.Context(), "")
		if loadErr != nil {
			t.Fatal(loadErr)
		}
		sessions.Put(ctx, "user_id", id.String())
		sessions.Put(ctx, "last_activity", time.Now().UnixNano())
		token, _, commitErr := sessions.Commit(ctx)
		if commitErr != nil {
			t.Fatal(commitErr)
		}
		return &http.Cookie{Name: "session", Value: token}
	}
	senderCookie, recipientCookie := cookie(sender), cookie(recipient)
	rtc, err := webrtc.New(0, nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if closeErr := rtc.Close(); closeErr != nil {
			t.Error(closeErr)
		}
	})
	handler, err := New(WithDatabase(db), WithWebRTC(rtc))
	if err != nil {
		t.Fatal(err)
	}
	request := func(method, path string, body []byte, session *http.Cookie) *httptest.ResponseRecorder {
		req := httptest.NewRequestWithContext(t.Context(), method, path, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.AddCookie(session)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		return rec
	}
	client, err := pion.NewPeerConnection(pion.Configuration{})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if closeErr := client.Close(); closeErr != nil {
			t.Error(closeErr)
		}
	})
	control, _ := createExpectedDataChannels(t, client)
	opened := make(chan struct{})
	received := make(chan pion.DataChannelMessage, 1)
	control.OnOpen(func() { close(opened) })
	control.OnMessage(func(message pion.DataChannelMessage) { received <- message })
	exchangeOffer(t, handler, client, recipientCookie)
	select {
	case <-opened:
	case <-time.After(5 * time.Second):
		t.Fatal("control channel did not open")
	}
	invalid := fmt.Appendf(nil, `{"friend_id":%q,"message":""}`, recipient.String())
	response := request(http.MethodPost, "/api/friends/chat/send-message", invalid, senderCookie)
	if response.Code == http.StatusOK {
		t.Fatal("empty message was accepted")
	}
	send := func(message string) {
		t.Helper()
		body := fmt.Appendf(nil, `{"friend_id":%q,"message":%q}`, recipient.String(), message)
		sent := request(http.MethodPost, "/api/friends/chat/send-message", body, senderCookie)
		if sent.Code != http.StatusOK {
			t.Fatalf("send: %d %s", sent.Code, sent.Body)
		}
	}
	send("hello")
	select {
	case message := <-received:
		var event struct {
			Type     string `json:"type"`
			SenderID string `json:"senderId"`
			Message  string `json:"message"`
		}
		if !message.IsString || json.Unmarshal(message.Data, &event) != nil || event.Type != "PrivateMessage" || event.SenderID != sender.String() || event.Message != "hello" {
			t.Fatalf("unexpected event: %s", message.Data)
		}
		response = request(http.MethodGet, "/api/friends/chat/get-messages?friend_id="+sender.String(), nil, recipientCookie)
		if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"message":"hello"`) {
			t.Fatalf("delivered message was not saved: %d %s", response.Code, response.Body)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("private message not delivered")
	}
	rtc.DisconnectAccount(recipient.String())
	send("offline")
	response = request(http.MethodGet, "/api/friends/chat/get-messages?friend_id="+recipient.String(), nil, senderCookie)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"message":"offline"`) {
		t.Fatalf("offline message was not saved: %d %s", response.Code, response.Body)
	}
}
