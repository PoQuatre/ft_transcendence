package webrtc

import (
	"context"
	"errors"
	"testing"

	pion "github.com/pion/webrtc/v4"
)

func TestValidateOfferRejectsMedia(t *testing.T) {
	offer := pion.SessionDescription{
		Type: pion.SDPTypeOffer,
		SDP: "v=0\r\n" +
			"o=- 1 1 IN IP4 127.0.0.1\r\n" +
			"s=-\r\n" +
			"t=0 0\r\n" +
			"m=audio 9 UDP/TLS/RTP/SAVPF 111\r\n",
	}

	err := validateOffer(offer)
	if !errors.Is(err, errMediaNotSupported) {
		t.Errorf("validateOffer() error = %v, want %v", err, errMediaNotSupported)
	}
	if !errors.Is(err, errInvalidOffer) {
		t.Errorf("validateOffer() error = %v, want %v", err, errInvalidOffer)
	}
}

func TestAnswerReturnsCanceledContext(t *testing.T) {
	server, err := New(0, []string{})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if closeErr := server.Close(); closeErr != nil {
			t.Error(closeErr)
		}
	})
	ctx, cancel := context.WithCancel(t.Context())
	cancel()

	if _, err := server.Answer(ctx, pion.SessionDescription{}); !errors.Is(err, context.Canceled) {
		t.Errorf("Answer() error = %v, want %v", err, context.Canceled)
	}
}

func TestServerCloseClosesManagedPeers(t *testing.T) {
	server, err := New(0, []string{})
	if err != nil {
		t.Fatal(err)
	}
	peer, err := server.api.NewPeerConnection(pion.Configuration{})
	if err != nil {
		t.Fatal(err)
	}
	if err := server.managePeer(peer); err != nil {
		t.Fatal(err)
	}

	if err := server.Close(); err != nil {
		t.Fatal(err)
	}
	if state := peer.ConnectionState(); state != pion.PeerConnectionStateClosed {
		t.Errorf("peer connection state = %s, want %s", state, pion.PeerConnectionStateClosed)
	}
}

func TestServerDoesNotManagePeersAfterClose(t *testing.T) {
	server, err := New(0, []string{})
	if err != nil {
		t.Fatal(err)
	}
	if err = server.Close(); err != nil {
		t.Fatal(err)
	}
	peer, err := server.api.NewPeerConnection(pion.Configuration{})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if closeErr := peer.Close(); closeErr != nil {
			t.Error(closeErr)
		}
	})

	if err := server.managePeer(peer); !errors.Is(err, errServerClosed) {
		t.Errorf("managePeer() error = %v, want %v", err, errServerClosed)
	}
}
