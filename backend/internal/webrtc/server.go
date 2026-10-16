// Package webrtc provides data-channel-only WebRTC connections.
package webrtc

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/pion/ice/v4"
	pion "github.com/pion/webrtc/v4"
)

var (
	errInvalidOffer      = errors.New("invalid SDP offer")
	errMediaNotSupported = errors.New("audio and video are not supported")
	errServerClosed      = errors.New("WebRTC server is closed")
)

const signalingTimeout = 10 * time.Second

type Server struct {
	api       *pion.API
	mux       *ice.MultiUDPMuxDefault
	peers     map[*pion.PeerConnection]struct{}
	closeErr  error
	closeOnce sync.Once
	mu        sync.Mutex
	closed    bool
}

func New(port int, external []string) (*Server, error) {
	mux, err := ice.NewMultiUDPMuxFromPort(port,
		ice.UDPMuxFromPortWithNetworks(ice.NetworkTypeUDP4),
		ice.UDPMuxFromPortWithLoopback(),
	)
	if err != nil {
		return nil, fmt.Errorf("listen for WebRTC UDP traffic: %w", err)
	}
	se := pion.SettingEngine{}
	se.SetICEUDPMux(mux)

	if len(external) == 0 {
		external = append(external, "127.0.0.1")
	}

	rewriteErr := se.SetICEAddressRewriteRules(
		pion.ICEAddressRewriteRule{
			Local:           "127.0.0.1",
			External:        external,
			AsCandidateType: pion.ICECandidateTypeHost,
			Mode:            pion.ICEAddressRewriteReplace,
		},
	)
	if rewriteErr != nil {
		closeErr := mux.Close()
		if closeErr != nil {
			return nil, errors.Join(
				fmt.Errorf("configure ICE address rewrite: %w", rewriteErr),
				fmt.Errorf("close WebRTC UDP listener: %w", closeErr),
			)
		}
		return nil, fmt.Errorf("configure ICE address rewrite: %w", rewriteErr)
	}

	return &Server{
		api:   pion.NewAPI(pion.WithSettingEngine(se)),
		mux:   mux,
		peers: make(map[*pion.PeerConnection]struct{}),
	}, nil
}

func (s *Server) Close() error {
	s.closeOnce.Do(func() {
		s.mu.Lock()
		s.closed = true
		peers := s.peers
		s.peers = nil
		s.mu.Unlock()

		errs := make([]error, 0, len(peers)+1)
		for peer := range peers {
			if err := peer.Close(); err != nil {
				errs = append(errs, fmt.Errorf("close WebRTC peer: %w", err))
			}
		}
		if err := s.mux.Close(); err != nil {
			errs = append(errs, fmt.Errorf("close WebRTC UDP listener: %w", err))
		}
		s.closeErr = errors.Join(errs...)
	})

	return s.closeErr
}

func (s *Server) Answer(ctx context.Context, offer pion.SessionDescription) (*pion.SessionDescription, error) {
	ctx, cancel := context.WithTimeout(ctx, signalingTimeout)
	defer cancel()

	if err := ctx.Err(); err != nil {
		return nil, err
	}
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
			s.removePeer(peer)
			if closeErr := peer.Close(); closeErr != nil {
				slog.Debug("close incomplete WebRTC peer", "error", closeErr)
			}
		}
	}()

	if err := s.managePeer(peer); err != nil {
		return nil, err
	}
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
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-gatherComplete:
		if err := ctx.Err(); err != nil {
			return nil, err
		}
	}

	closePeer = false
	return peer.LocalDescription(), nil
}

func (s *Server) managePeer(peer *pion.PeerConnection) error {
	peer.OnConnectionStateChange(func(state pion.PeerConnectionState) {
		switch state {
		case pion.PeerConnectionStateFailed:
			if err := peer.Close(); err != nil {
				slog.Debug("close failed WebRTC peer", "error", err)
			}
		case pion.PeerConnectionStateClosed:
			s.removePeer(peer)
		default:
		}
	})

	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return errServerClosed
	}
	s.peers[peer] = struct{}{}
	return nil
}

func (s *Server) removePeer(peer *pion.PeerConnection) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.peers, peer)
}

func validateOffer(offer pion.SessionDescription) error {
	if offer.Type != pion.SDPTypeOffer {
		return fmt.Errorf("%w: expected an SDP offer", errInvalidOffer)
	}

	description, err := offer.Unmarshal()
	if err != nil {
		return fmt.Errorf("%w: parse SDP offer: %w", errInvalidOffer, err)
	}
	for _, media := range description.MediaDescriptions {
		if media.MediaName.Media != "application" {
			return fmt.Errorf("%w: %w", errInvalidOffer, errMediaNotSupported)
		}
	}

	return nil
}
