package webrtc

import (
	"context"
	"errors"
	"testing"
	"time"

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
	if err := server.managePeer(peer, nil); err != nil {
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

	if err := server.managePeer(peer, nil); !errors.Is(err, errServerClosed) {
		t.Errorf("managePeer() error = %v, want %v", err, errServerClosed)
	}
}

func TestExpectedDataChannel(t *testing.T) {
	zero := uint16(0)
	one := uint16(1)
	tests := []struct {
		name                         string
		label                        string
		ordered                      bool
		maxRetransmits, maxPacketAge *uint16
		want                         bool
	}{
		{name: "control", label: "control", ordered: true, want: true},
		{name: "event", label: "event", ordered: true, want: true},
		{name: "state", label: "state", maxRetransmits: &zero, want: true},
		{name: "sync", label: "sync", want: true},
		{name: "unknown", label: "unknown", want: false},
		{name: "ordered state", label: "state", ordered: true, maxRetransmits: &zero, want: false},
		{name: "reliable state", label: "state", want: false},
		{name: "limited retries", label: "state", maxRetransmits: &one, want: false},
		{name: "max packet age", label: "sync", maxPacketAge: &zero, want: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := expectedDataChannel(test.label, test.ordered, test.maxRetransmits, test.maxPacketAge); got != test.want {
				t.Errorf("expectedDataChannel() = %t, want %t", got, test.want)
			}
		})
	}
}

func TestDataChannelValidatorRejectsMissingChannels(t *testing.T) {
	originalTimeout := dataChannelDeclarationTimeout
	dataChannelDeclarationTimeout = time.Millisecond
	t.Cleanup(func() { dataChannelDeclarationTimeout = originalTimeout })

	peer, err := pion.NewPeerConnection(pion.Configuration{})
	if err != nil {
		t.Fatal(err)
	}
	closed := make(chan struct{})
	peer.OnConnectionStateChange(func(state pion.PeerConnectionState) {
		if state == pion.PeerConnectionStateClosed {
			close(closed)
		}
	})
	t.Cleanup(func() {
		if closeErr := peer.Close(); closeErr != nil {
			t.Error(closeErr)
		}
	})

	newDataChannelValidator(peer).connectionStateChanged(pion.PeerConnectionStateConnected)
	select {
	case <-closed:
	case <-time.After(time.Second):
		t.Fatal("peer was not closed for missing data channels")
	}
}
