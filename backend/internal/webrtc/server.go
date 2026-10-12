// Package webrtc provides data-channel-only WebRTC connections.
package webrtc

import (
	"errors"
	"fmt"
	"log/slog"

	"github.com/pion/ice/v4"
	pion "github.com/pion/webrtc/v4"
)

var errMediaNotSupported = errors.New("audio and video are not supported")

type Server struct {
	api *pion.API
	mux *ice.MultiUDPMuxDefault
}

func New(port int) (*Server, error) {
	mux, err := ice.NewMultiUDPMuxFromPort(port,
		ice.UDPMuxFromPortWithNetworks(ice.NetworkTypeUDP4),
		ice.UDPMuxFromPortWithLoopback(),
	)
	if err != nil {
		return nil, fmt.Errorf("listen for WebRTC UDP traffic: %w", err)
	}

	se := pion.SettingEngine{}
	se.SetICEUDPMux(mux)

	return &Server{
		api: pion.NewAPI(pion.WithSettingEngine(se)),
		mux: mux,
	}, nil
}

func (s *Server) Close() error {
	return s.mux.Close()
}

func (s *Server) Answer(offer pion.SessionDescription) (*pion.SessionDescription, error) {
	if err := validateOffer(offer); err != nil {
		return nil, err
	}

	peer, err := s.api.NewPeerConnection(pion.Configuration{})
	if err != nil {
		return nil, fmt.Errorf("create peer connection: %w", err)
	}
	closePeer := true
	defer func() {
		if closePeer {
			if closeErr := peer.Close(); closeErr != nil {
				slog.Debug("close incomplete WebRTC peer", "error", closeErr)
			}
		}
	}()

	peer.OnICEConnectionStateChange(func(state pion.ICEConnectionState) {
		if state == pion.ICEConnectionStateFailed {
			if closeErr := peer.Close(); closeErr != nil {
				slog.Debug("close WebRTC peer", "error", closeErr)
			}
		}
	})
	peer.OnDataChannel(func(channel *pion.DataChannel) {
		channel.OnMessage(func(message pion.DataChannelMessage) {
			var sendErr error
			if message.IsString {
				sendErr = channel.SendText(string(message.Data))
			} else {
				sendErr = channel.Send(message.Data)
			}
			if sendErr != nil {
				slog.Debug("echo WebRTC data-channel message", "error", sendErr)
			}
		})
	})

	remoteDescriptionErr := peer.SetRemoteDescription(offer)
	if remoteDescriptionErr != nil {
		return nil, fmt.Errorf("set remote description: %w", remoteDescriptionErr)
	}

	gatherComplete := pion.GatheringCompletePromise(peer)
	answer, createAnswerErr := peer.CreateAnswer(nil)
	if createAnswerErr != nil {
		return nil, fmt.Errorf("create answer: %w", createAnswerErr)
	}
	localDescriptionErr := peer.SetLocalDescription(answer)
	if localDescriptionErr != nil {
		return nil, fmt.Errorf("set local description: %w", localDescriptionErr)
	}
	<-gatherComplete

	closePeer = false
	return peer.LocalDescription(), nil
}

func validateOffer(offer pion.SessionDescription) error {
	if offer.Type != pion.SDPTypeOffer {
		return errors.New("expected an SDP offer")
	}

	description, err := offer.Unmarshal()
	if err != nil {
		return fmt.Errorf("parse SDP offer: %w", err)
	}
	for _, media := range description.MediaDescriptions {
		if media.MediaName.Media != "application" {
			return errMediaNotSupported
		}
	}

	return nil
}
