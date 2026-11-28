package webrtc

import (
	"testing"

	pion "github.com/pion/webrtc/v4"
)

func TestSendControlWithUnavailableChannel(t *testing.T) {
	peer, err := pion.NewPeerConnection(pion.Configuration{})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err = peer.Close(); err != nil {
			t.Error(err)
		}
	})
	channel, err := peer.CreateDataChannel("control", nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := channel.SendText("test"); err == nil {
		t.Fatal("expected a send error for a channel that is not open")
	}
	sendControl(channel, map[string]string{"type": "PrivateMessage", "senderId": "sender", "message": "hello"})
}
