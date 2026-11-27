package chat

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/alexedwards/scs/v2"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v5"
)

type mockRepository struct {
	friends map[[2]uuid.UUID]bool
	err     error
}

func newMockRepository() *mockRepository {
	return &mockRepository{
		friends: make(map[[2]uuid.UUID]bool),
	}
}

func (m *mockRepository) addFriendship(a, b uuid.UUID) {
	m.friends[[2]uuid.UUID{a, b}] = true
	m.friends[[2]uuid.UUID{b, a}] = true
}

func (m *mockRepository) AreFriend(_ context.Context, userID, friendID uuid.UUID) (bool, error) {
	if m.err != nil {
		return false, m.err
	}
	return m.friends[[2]uuid.UUID{userID, friendID}], nil
}

func setupTestServer(t *testing.T, repo Repository) (*httptest.Server, *Service, *scs.SessionManager) {
	t.Helper()

	sessionManager := scs.New()
	svc := NewService(repo)

	e := echo.New()
	e.Use(echo.WrapMiddleware(sessionManager.LoadAndSave))

	e.GET("/test-login/:id", func(c *echo.Context) error {
		sessionManager.Put(c.Request().Context(), "user_id", c.Param("id"))
		return c.NoContent(http.StatusOK)
	})

	RegisterRoutes(e.Group("/chat"), svc, sessionManager)

	srv := httptest.NewServer(e)
	t.Cleanup(srv.Close)

	return srv, svc, sessionManager
}

func dialAuthenticated(t *testing.T, srv *httptest.Server, userID uuid.UUID) *websocket.Conn {
	t.Helper()

	resp, err := http.Get(srv.URL + "/test-login/" + userID.String())
	if err != nil {
		t.Fatalf("failed to login test user %s: %v", userID, err)
	}
	_ = resp.Body.Close()

	header := http.Header{}
	for _, cookie := range resp.Cookies() {
		header.Add("Cookie", cookie.String())
	}

	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http") + "/chat/ws"
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, header)
	if err != nil {
		t.Fatalf("failed to dial websocket for user %s: %v", userID, err)
	}
	t.Cleanup(func() { _ = conn.Close() })

	return conn
}

func TestWS_Unauthorized(t *testing.T) {
	repo := newMockRepository()
	srv, _, _ := setupTestServer(t, repo)

	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http") + "/chat/ws"
	_, resp, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err == nil {
		t.Fatal("expected websocket dial to fail without session, got nil error")
	}
	if resp == nil || resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected HTTP 401 Unauthorized, got %v", resp)
	}
}

func TestWS_ForwardSignalBetweenFriends(t *testing.T) {
	repo := newMockRepository()
	aliceID := uuid.New()
	bobID := uuid.New()
	repo.addFriendship(aliceID, bobID)

	srv, _, _ := setupTestServer(t, repo)

	aliceConn := dialAuthenticated(t, srv, aliceID)
	bobConn := dialAuthenticated(t, srv, bobID)

	time.Sleep(30 * time.Millisecond)

	fakeID := uuid.New()
	offerPayload := json.RawMessage(`{"type":"offer","sdp":"v=0\r\n..."}`)
	if err := aliceConn.WriteJSON(SignalMessage{
		Type:     "offer",
		TargetID: bobID,
		SenderID: fakeID,
		Payload:  offerPayload,
	}); err != nil {
		t.Fatalf("alice failed to write offer: %v", err)
	}

	_ = bobConn.SetReadDeadline(time.Now().Add(2 * time.Second))
	var received SignalMessage
	if err := bobConn.ReadJSON(&received); err != nil {
		t.Fatalf("bob failed to read offer: %v", err)
	}

	if received.SenderID != aliceID {
		t.Errorf("expected SenderID to be %s, got %s", aliceID, received.SenderID)
	}
	if received.Type != "offer" || string(received.Payload) != string(offerPayload) {
		t.Errorf("unexpected message received: %+v", received)
	}

	answerPayload := json.RawMessage(`{"type":"answer","sdp":"v=0\r\n..."}`)
	if err := bobConn.WriteJSON(SignalMessage{
		Type:     "answer",
		TargetID: aliceID,
		Payload:  answerPayload,
	}); err != nil {
		t.Fatalf("bob failed to write answer: %v", err)
	}

	_ = aliceConn.SetReadDeadline(time.Now().Add(2 * time.Second))
	var answerReceived SignalMessage
	if err := aliceConn.ReadJSON(&answerReceived); err != nil {
		t.Fatalf("alice failed to read answer: %v", err)
	}

	if answerReceived.SenderID != bobID || answerReceived.Type != "answer" {
		t.Errorf("unexpected answer received: %+v", answerReceived)
	}
}

func TestWS_RejectNonFriendsAndSelfAndUnknownTypes(t *testing.T) {
	repo := newMockRepository()
	aliceID := uuid.New()
	strangerID := uuid.New()

	srv, _, _ := setupTestServer(t, repo)

	aliceConn := dialAuthenticated(t, srv, aliceID)
	strangerConn := dialAuthenticated(t, srv, strangerID)

	time.Sleep(30 * time.Millisecond)

	_ = aliceConn.WriteJSON(SignalMessage{
		Type:     "offer",
		TargetID: strangerID,
		Payload:  json.RawMessage(`{"sdp":"blocked"}`),
	})

	_ = aliceConn.WriteJSON(SignalMessage{
		Type:     "offer",
		TargetID: aliceID,
		Payload:  json.RawMessage(`{"sdp":"self"}`),
	})

	_ = strangerConn.SetReadDeadline(time.Now().Add(150 * time.Millisecond))
	var msg SignalMessage
	if err := strangerConn.ReadJSON(&msg); err == nil {
		t.Fatalf("expected no message for non-friend, but received: %+v", msg)
	}

	_ = aliceConn.SetReadDeadline(time.Now().Add(150 * time.Millisecond))
	if err := aliceConn.ReadJSON(&msg); err == nil {
		t.Fatalf("expected no self-message, but received: %+v", msg)
	}
}

func TestWS_ReplaceExistingConnection(t *testing.T) {
	repo := newMockRepository()
	aliceID := uuid.New()
	bobID := uuid.New()
	repo.addFriendship(aliceID, bobID)

	srv, _, _ := setupTestServer(t, repo)

	firstConn := dialAuthenticated(t, srv, aliceID)
	time.Sleep(20 * time.Millisecond)

	secondConn := dialAuthenticated(t, srv, aliceID)
	bobConn := dialAuthenticated(t, srv, bobID)

	_ = firstConn.SetReadDeadline(time.Now().Add(500 * time.Millisecond))
	if _, _, err := firstConn.ReadMessage(); err == nil {
		t.Fatal("expected first connection to be closed when second connection registers")
	}

	candidate := json.RawMessage(`{"candidate":"candidate:1 1 UDP 2122252543 127.0.0.1 50000 typ host"}`)
	if err := bobConn.WriteJSON(SignalMessage{
		Type:     "ice-candidate",
		TargetID: aliceID,
		Payload:  candidate,
	}); err != nil {
		t.Fatalf("bob write failed: %v", err)
	}

	_ = secondConn.SetReadDeadline(time.Now().Add(2 * time.Second))
	var received SignalMessage
	if err := secondConn.ReadJSON(&received); err != nil {
		t.Fatalf("second connection failed to read candidate: %v", err)
	}
	if received.Type != "ice-candidate" {
		t.Errorf("expected ice-candidate, got %s", received.Type)
	}
}

func TestService_DisconnectUserAndRepoError(t *testing.T) {
	repo := newMockRepository()
	aliceID := uuid.New()
	bobID := uuid.New()
	repo.addFriendship(aliceID, bobID)

	srv, svc, _ := setupTestServer(t, repo)

	aliceConn := dialAuthenticated(t, srv, aliceID)
	bobConn := dialAuthenticated(t, srv, bobID)
	time.Sleep(30 * time.Millisecond)

	repo.err = errors.New("db connection lost")
	_ = aliceConn.WriteJSON(SignalMessage{
		Type:     "offer",
		TargetID: bobID,
		Payload:  json.RawMessage(`{"sdp":"test"}`),
	})

	_ = bobConn.SetReadDeadline(time.Now().Add(150 * time.Millisecond))
	var msg SignalMessage
	if err := bobConn.ReadJSON(&msg); err == nil {
		t.Fatalf("expected signal to be dropped on repo error, got %+v", msg)
	}

	svc.DisconnectUser(aliceID)

	_ = aliceConn.SetReadDeadline(time.Now().Add(500 * time.Millisecond))
	if _, _, err := aliceConn.ReadMessage(); err == nil {
		t.Fatal("expected alice connection to close after DisconnectUser")
	}
}
