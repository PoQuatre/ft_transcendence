package server

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	pion "github.com/pion/webrtc/v4"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
	"github.com/uptrace/bun/driver/pgdriver"

	"github.com/PoQuatre/ft_transcendence/backend/internal/webrtc"
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

func TestWebRTCOfferEchoesMessage(t *testing.T) {
	webRTC, err := webrtc.New(0)
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

	channel, err := client.CreateDataChannel("echo", nil)
	if err != nil {
		t.Fatal(err)
	}
	received := make(chan pion.DataChannelMessage, 1)
	channel.OnMessage(func(message pion.DataChannelMessage) { received <- message })
	opened := make(chan struct{})
	sendErrors := make(chan error, 1)
	channel.OnOpen(func() {
		sendErrors <- channel.SendText("hello")
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
		if !message.IsString || string(message.Data) != "hello" {
			t.Errorf("echoed message = %#v, want text hello", message)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("did not receive echoed data-channel message")
	}
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
