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

func setupTestServer(t *testing.T, repo Repository) (*httptest.Server, *Service) {
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

	return srv, svc
}

func closeResponseBody(t *testing.T, resp *http.Response) {
	t.Helper()
	if resp != nil && resp.Body != nil {
		if err := resp.Body.Close(); err != nil {
			t.Logf("close response body: %v", err)
		}
	}
}

func mustSetReadDeadline(t *testing.T, conn *websocket.Conn, d time.Duration) {
	t.Helper()
	if err := conn.SetReadDeadline(time.Now().Add(d)); err != nil {
		t.Fatalf("failed to set read deadline: %v", err)
	}
}

func mustWriteJSON(t *testing.T, conn *websocket.Conn, msg SignalMessage) {
	t.Helper()
	if err := conn.WriteJSON(msg); err != nil {
		t.Fatalf("failed to write JSON message: %v", err)
	}
}

func dialAuthenticated(t *testing.T, srv *httptest.Server, userID uuid.UUID) *websocket.Conn {
	t.Helper()

	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, srv.URL+"/test-login/"+userID.String(), nil)
	if err != nil {
		t.Fatalf("failed to build login request for %s: %v", userID, err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("failed to login test user %s: %v", userID, err)
	}
	cookies := resp.Cookies()
	closeResponseBody(t, resp)

	header := http.Header{}
	for _, cookie := range cookies {
		header.Add("Cookie", cookie.String())
	}

	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http") + "/chat/ws"
	conn, dialResp, err := websocket.DefaultDialer.Dial(wsURL, header)
	closeResponseBody(t, dialResp)
	if err != nil {
		t.Fatalf("failed to dial websocket for user %s: %v", userID, err)
	}

	t.Cleanup(func() {
		if closeErr := conn.Close(); closeErr != nil {
			t.Logf("cleanup close websocket for %s: %v", userID, closeErr)
		}
	})

	return conn
}

func TestWS_Unauthorized(t *testing.T) {
	repo := newMockRepository()
	srv, _ := setupTestServer(t, repo)

	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http") + "/chat/ws"
	conn, resp, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if conn != nil {
		if closeErr := conn.Close(); closeErr != nil {
			t.Logf("close unexpected conn: %v", closeErr)
		}
	}
	closeResponseBody(t, resp)

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

	srv, _ := setupTestServer(t, repo)

	aliceConn := dialAuthenticated(t, srv, aliceID)
	bobConn := dialAuthenticated(t, srv, bobID)

	time.Sleep(30 * time.Millisecond)

	fakeID := uuid.New()
	offerPayload := json.RawMessage(`{"type":"offer","sdp":"v=0\r\n..."}`)
	mustWriteJSON(t, aliceConn, SignalMessage{
		Type:     "offer",
		TargetID: bobID,
		SenderID: fakeID,
		Payload:  offerPayload,
	})

	mustSetReadDeadline(t, bobConn, 2*time.Second)
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
	mustWriteJSON(t, bobConn, SignalMessage{
		Type:     "answer",
		TargetID: aliceID,
		Payload:  answerPayload,
	})

	mustSetReadDeadline(t, aliceConn, 2*time.Second)
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

	srv, _ := setupTestServer(t, repo)

	aliceConn := dialAuthenticated(t, srv, aliceID)
	strangerConn := dialAuthenticated(t, srv, strangerID)

	time.Sleep(30 * time.Millisecond)

	mustWriteJSON(t, aliceConn, SignalMessage{
		Type:     "offer",
		TargetID: strangerID,
		Payload:  json.RawMessage(`{"sdp":"blocked"}`),
	})

	mustWriteJSON(t, aliceConn, SignalMessage{
		Type:     "offer",
		TargetID: aliceID,
		Payload:  json.RawMessage(`{"sdp":"self"}`),
	})

	mustSetReadDeadline(t, strangerConn, 150*time.Millisecond)
	var msg SignalMessage
	if err := strangerConn.ReadJSON(&msg); err == nil {
		t.Fatalf("expected no message for non-friend, but received: %+v", msg)
	}

	mustSetReadDeadline(t, aliceConn, 150*time.Millisecond)
	if err := aliceConn.ReadJSON(&msg); err == nil {
		t.Fatalf("expected no self-message, but received: %+v", msg)
	}
}

func TestWS_ReplaceExistingConnection(t *testing.T) {
	repo := newMockRepository()
	aliceID := uuid.New()
	bobID := uuid.New()
	repo.addFriendship(aliceID, bobID)

	srv, _ := setupTestServer(t, repo)

	firstConn := dialAuthenticated(t, srv, aliceID)
	time.Sleep(20 * time.Millisecond)

	secondConn := dialAuthenticated(t, srv, aliceID)
	bobConn := dialAuthenticated(t, srv, bobID)

	mustSetReadDeadline(t, firstConn, 500*time.Millisecond)
	if _, _, err := firstConn.ReadMessage(); err == nil {
		t.Fatal("expected first connection to be closed when second connection registers")
	}

	candidate := json.RawMessage(`{"candidate":"candidate:1 1 UDP 2122252543 127.0.0.1 50000 typ host"}`)
	mustWriteJSON(t, bobConn, SignalMessage{
		Type:     "ice-candidate",
		TargetID: aliceID,
		Payload:  candidate,
	})

	mustSetReadDeadline(t, secondConn, 2*time.Second)
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

	srv, svc := setupTestServer(t, repo)

	aliceConn := dialAuthenticated(t, srv, aliceID)
	bobConn := dialAuthenticated(t, srv, bobID)
	time.Sleep(30 * time.Millisecond)

	repo.err = errors.New("db connection lost")
	mustWriteJSON(t, aliceConn, SignalMessage{
		Type:     "offer",
		TargetID: bobID,
		Payload:  json.RawMessage(`{"sdp":"test"}`),
	})

	mustSetReadDeadline(t, bobConn, 150*time.Millisecond)
	var msg SignalMessage
	if err := bobConn.ReadJSON(&msg); err == nil {
		t.Fatalf("expected signal to be dropped on repo error, got %+v", msg)
	}

	svc.DisconnectUser(aliceID)

	mustSetReadDeadline(t, aliceConn, 500*time.Millisecond)
	if _, _, err := aliceConn.ReadMessage(); err == nil {
		t.Fatal("expected alice connection to close after DisconnectUser")
	}
}
