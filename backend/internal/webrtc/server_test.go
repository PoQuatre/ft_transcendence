package webrtc

import (
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

	if err := validateOffer(offer); !errors.Is(err, errMediaNotSupported) {
		t.Errorf("validateOffer() error = %v, want %v", err, errMediaNotSupported)
	}
}
