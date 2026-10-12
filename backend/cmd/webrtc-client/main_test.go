package main

import (
	"context"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/PoQuatre/ft_transcendence/backend/internal/server"
	"github.com/PoQuatre/ft_transcendence/backend/internal/webrtc"
)

func TestConnectEchoesMessage(t *testing.T) {
	webRTC, err := webrtc.New(0)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if closeErr := webRTC.Close(); closeErr != nil {
			t.Error(closeErr)
		}
	})

	handler, err := server.New(server.WithWebRTC(webRTC))
	if err != nil {
		t.Fatal(err)
	}
	httpServer := httptest.NewServer(handler)
	t.Cleanup(httpServer.Close)

	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()
	connection, err := connect(ctx, httpServer.Client(), httpServer.URL+"/api/webrtc/offer")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if closeErr := connection.peer.Close(); closeErr != nil {
			t.Error(closeErr)
		}
	})

	if err := connection.channel.SendText("hello"); err != nil {
		t.Fatal(err)
	}
	select {
	case message := <-connection.messages:
		if !message.IsString || string(message.Data) != "hello" {
			t.Errorf("echoed message = %#v, want text hello", message)
		}
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}
}
