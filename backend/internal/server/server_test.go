package server

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	pion "github.com/pion/webrtc/v4"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
	"github.com/uptrace/bun/driver/pgdriver"

	"github.com/PoQuatre/ft_transcendence/backend/internal/game/webrtc"
)

func TestNewHealthzWithoutDatabase(t *testing.T) {
	srv, err := New()
	if err != nil {
		t.Fatalf("failed to create server : %v", err)
	}
	response := serve(t, srv, http.MethodGet, "/healthz")

	if response.Code != http.StatusOK {
		t.Fatalf("GET /healthz status = %d, want %d", response.Code, http.StatusOK)
	}
	assertStatusResponse(t, response, "ok")
}

func TestNewHealthzWithUnavailableDatabase(t *testing.T) {
	database := unavailableDatabase(t)
	srv, err := New(WithDatabase(database))
	if err != nil {
		t.Fatalf("failed to create server : %v", err)
	}
	response := serve(t, srv, http.MethodGet, "/healthz")

	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("GET /healthz status = %d, want %d", response.Code, http.StatusServiceUnavailable)
	}
	assertStatusResponse(t, response, "unavailable")
}

func TestNewDoesNotRegisterAuthRoutesWithoutDatabase(t *testing.T) {
	srv, err := New()
	if err != nil {
		t.Fatalf("failed to create server : %v", err)
	}
	response := serve(t, srv, http.MethodGet, "/api/auth")

	if response.Code != http.StatusNotFound {
		t.Errorf("GET /api/auth status = %d, want %d", response.Code, http.StatusNotFound)
	}
}

func TestWebRTCQuickPlayReceivesLobbyState(t *testing.T) {
	webRTC, err := webrtc.New(0, []string{})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		closeErr := webRTC.Close()
		if closeErr != nil {
			t.Error(closeErr)
		}
	})

	handler, err := New(WithWebRTC(webRTC))
	if err != nil {
		t.Fatal(err)
	}
	client, err := pion.NewPeerConnection(pion.Configuration{})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		closeErr := client.Close()
		if closeErr != nil {
			t.Error(closeErr)
		}
	})

	channel, event := createExpectedDataChannels(t, client)
	eventClosed := make(chan struct{})
	event.OnClose(func() { close(eventClosed) })
	received := make(chan pion.DataChannelMessage, 1)
	channel.OnMessage(func(message pion.DataChannelMessage) { received <- message })
	opened := make(chan struct{})
	sendErrors := make(chan error, 1)
	channel.OnOpen(func() {
		sendErrors <- channel.SendText(`{"type":"QuickPlayRequest"}`)
		close(opened)
	})

	offer, err := client.CreateOffer(nil)
	if err != nil {
		t.Fatal(err)
	}
	gatherComplete := pion.GatheringCompletePromise(client)
	localDescriptionErr := client.SetLocalDescription(offer)
	if localDescriptionErr != nil {
		t.Fatal(localDescriptionErr)
	}
	<-gatherComplete

	body, err := json.Marshal(client.LocalDescription())
	if err != nil {
		t.Fatal(err)
	}
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequestWithContext(
		t.Context(), http.MethodPost, "/api/webrtc/offer", bytes.NewReader(body),
	))
	if response.Code != http.StatusOK {
		t.Fatalf("POST /api/webrtc/offer status = %d, want %d: %s", response.Code, http.StatusOK, response.Body)
	}

	var answer pion.SessionDescription
	if err := json.NewDecoder(response.Body).Decode(&answer); err != nil {
		t.Fatal(err)
	}
	if err := client.SetRemoteDescription(answer); err != nil {
		t.Fatal(err)
	}

	select {
	case <-opened:
	case <-time.After(5 * time.Second):
		t.Fatal("data channel did not open")
	}
	if sendErr := <-sendErrors; sendErr != nil {
		t.Fatal(sendErr)
	}
	select {
	case message := <-received:
		var state struct {
			Type    string `json:"type"`
			LobbyID string `json:"lobbyId"`
			Players []struct {
				ID       string `json:"id"`
				Username string `json:"username"`
			} `json:"players"`
		}
		if !message.IsString || json.Unmarshal(message.Data, &state) != nil || state.Type != "LobbyState" || state.LobbyID == "" || len(state.Players) != 1 || state.Players[0].ID == "" || state.Players[0].Username == "" {
			t.Errorf("unexpected lobby state: %s", message.Data)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("did not receive lobby state")
	}
	if err := channel.Close(); err != nil {
		t.Fatal(err)
	}
	select {
	case <-eventClosed:
	case <-time.After(5 * time.Second):
		t.Fatal("peer remained open after control channel closed")
	}
}

func TestWebRTCRejectsInvalidSession(t *testing.T) {
	handler := newWebRTCTestHandler(t)
	req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/api/webrtc/offer", bytes.NewReader([]byte(`{}`)))
	req.AddCookie(&http.Cookie{Name: "session", Value: "invalid"})
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, req)
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", response.Code)
	}
}

func TestUnrelatedLogoutDoesNotWaitForOffer(t *testing.T) {
	handler := newWebRTCTestHandler(t)
	reader, writer := io.Pipe()
	t.Cleanup(func() { _ = writer.Close() })
	started := make(chan struct{})
	request := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/api/webrtc/offer", &signalingBody{Reader: reader, started: started})
	offerDone := make(chan struct{})
	go func() {
		handler.ServeHTTP(httptest.NewRecorder(), request)
		close(offerDone)
	}()
	<-started
	logoutDone := make(chan struct{})
	go func() {
		logout := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/api/auth/logout", nil)
		logout.AddCookie(&http.Cookie{Name: "session", Value: "another-session"})
		handler.ServeHTTP(httptest.NewRecorder(), logout)
		close(logoutDone)
	}()
	select {
	case <-logoutDone:
	case <-time.After(time.Second):
		t.Error("unrelated logout blocked by an in-flight offer")
	}
	_ = writer.Close()
	<-offerDone
	<-logoutDone
}

type signalingBody struct {
	io.Reader
	started chan struct{}
}

func (b *signalingBody) Read(p []byte) (int, error) {
	close(b.started)
	return b.Reader.Read(p)
}

func TestKeyedLocksSerializeOnlyMatchingKeys(t *testing.T) {
	var locks keyedLocks
	unlock := locks.lock("same")
	started := make(chan struct{})
	acquired := make(chan struct{})
	go func() {
		close(started)
		release := locks.lock("same")
		close(acquired)
		release()
	}()
	<-started
	other := locks.lock("other")
	other()
	select {
	case <-acquired:
		t.Error("matching key acquired before unlock")
	default:
	}
	unlock()
	select {
	case <-acquired:
	case <-time.After(time.Second):
		t.Fatal("matching key remained locked")
	}
}

func TestWebRTCRejectsBearerToken(t *testing.T) {
	handler := newWebRTCTestHandler(t)
	for _, cookie := range []bool{false, true} {
		req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/api/webrtc/offer", bytes.NewReader([]byte(`{}`)))
		req.Header.Set("Authorization", "Bearer token")
		if cookie {
			req.AddCookie(&http.Cookie{Name: "session", Value: "invalid"})
		}
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, req)
		if response.Code != http.StatusUnauthorized {
			t.Fatalf("cookie=%t: status = %d, want 401", cookie, response.Code)
		}
	}
}

func newWebRTCTestHandler(t *testing.T) http.Handler {
	t.Helper()
	webRTC, err := webrtc.New(0, nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if closeErr := webRTC.Close(); closeErr != nil {
			t.Error(closeErr)
		}
	})
	handler, err := New(WithWebRTC(webRTC))
	if err != nil {
		t.Fatal(err)
	}
	return handler
}

func createExpectedDataChannels(t *testing.T, peer *pion.PeerConnection) (*pion.DataChannel, *pion.DataChannel) {
	t.Helper()
	control, err := peer.CreateDataChannel("control", nil)
	if err != nil {
		t.Fatal(err)
	}
	var event *pion.DataChannel
	for _, label := range []string{"event", "sync"} {
		options := (*pion.DataChannelInit)(nil)
		if label == "sync" {
			ordered := false
			options = &pion.DataChannelInit{Ordered: &ordered}
		}
		channel, err := peer.CreateDataChannel(label, options)
		if err != nil {
			t.Fatal(err)
		}
		if label == "event" {
			event = channel
		}
	}
	ordered := false
	maxRetransmits := uint16(0)
	if _, err := peer.CreateDataChannel("state", &pion.DataChannelInit{
		Ordered:        &ordered,
		MaxRetransmits: &maxRetransmits,
	}); err != nil {
		t.Fatal(err)
	}
	return control, event
}

func serve(t *testing.T, handler http.Handler, method, target string) *httptest.ResponseRecorder {
	t.Helper()
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequestWithContext(t.Context(), method, target, nil))
	return response
}

func assertStatusResponse(t *testing.T, response *httptest.ResponseRecorder, want string) {
	t.Helper()
	var got struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(response.Body).Decode(&got); err != nil {
		t.Fatalf("decode response body %q: %v", response.Body.String(), err)
	}
	if got.Status != want {
		t.Errorf("response status = %q, want %q", got.Status, want)
	}
}

func unavailableDatabase(t *testing.T) *bun.DB {
	t.Helper()
	sqlDatabase := sql.OpenDB(pgdriver.NewConnector())
	if err := sqlDatabase.Close(); err != nil {
		t.Fatal(err)
	}
	return bun.NewDB(sqlDatabase, pgdialect.New())
}
