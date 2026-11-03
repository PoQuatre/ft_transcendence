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
	errAccountConnected  = errors.New("account already connected")
)

const signalingTimeout = 10 * time.Second

var dataChannelDeclarationTimeout = 10 * time.Second
var connectionTimeout = 30 * time.Second

var unreliableMaxRetransmits = uint16(0)

type dataChannelConfig struct {
	maxRetransmits *uint16
	ordered        bool
}

var expectedDataChannels = map[string]dataChannelConfig{
	"control": {ordered: true},
	"event":   {ordered: true},
	"state":   {ordered: false, maxRetransmits: &unreliableMaxRetransmits},
	"sync":    {ordered: false},
}

type Server struct {
	api       *pion.API
	mux       *ice.MultiUDPMuxDefault
	players   map[*pion.PeerConnection]*player
	accounts  map[string]*pion.PeerConnection
	closeErr  error
	lobbies   []*lobby
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
		api:      pion.NewAPI(pion.WithSettingEngine(se)),
		mux:      mux,
		players:  make(map[*pion.PeerConnection]*player),
		accounts: make(map[string]*pion.PeerConnection),
	}, nil
}

func (s *Server) Close() error {
	s.closeOnce.Do(func() {
		s.mu.Lock()
		s.closed = true
		peers := make([]*pion.PeerConnection, 0, len(s.players))
		for peer := range s.players {
			peers = append(peers, peer)
		}
		s.mu.Unlock()

		errs := make([]error, 0, len(peers)+1)
		for _, peer := range peers {
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

func (s *Server) answer(ctx context.Context, offer pion.SessionDescription, identity Identity) (*pion.SessionDescription, error) {
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

	channels := newDataChannelValidator(peer)
	p, err := newPlayer(identity)
	if err != nil {
		return nil, err
	}
	if err := s.managePlayer(peer, channels, p); err != nil {
		return nil, err
	}
	channels.startConnectionTimeout()
	peer.OnDataChannel(func(channel *pion.DataChannel) {
		if !channels.add(channel) {
			return
		}
		if channel.Label() == "control" {
			channel.OnClose(func() {
				if err := peer.Close(); err != nil {
					slog.Debug("close WebRTC peer after control channel closed", "error", err)
				}
			})
		}
		channel.OnMessage(func(message pion.DataChannelMessage) {
			if channel.Label() == "control" {
				s.control(peer, channel, message)
				return
			}
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

func (s *Server) managePlayer(peer *pion.PeerConnection, validator *dataChannelValidator, p *player) error {
	peer.OnConnectionStateChange(func(state pion.PeerConnectionState) {
		if validator != nil {
			validator.connectionStateChanged(state)
		}
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
	if p.accountID != "" {
		if s.accounts[p.accountID] != nil {
			return errAccountConnected
		}
		s.accounts[p.accountID] = peer
	}
	s.players[peer] = p
	return nil
}

type dataChannelValidator struct {
	peer            *pion.PeerConnection
	timer           *time.Timer
	connectionTimer *time.Timer
	seen            map[string]struct{}
	mu              sync.Mutex
	rejected        bool
	connected       bool
}

func newDataChannelValidator(peer *pion.PeerConnection) *dataChannelValidator {
	return &dataChannelValidator{peer: peer, seen: make(map[string]struct{})}
}

func (v *dataChannelValidator) startConnectionTimeout() {
	v.mu.Lock()
	defer v.mu.Unlock()
	if v.connected || v.rejected {
		return
	}
	v.connectionTimer = time.AfterFunc(connectionTimeout, func() {
		v.mu.Lock()
		if v.connected || v.rejected {
			v.mu.Unlock()
			return
		}
		v.rejected = true
		v.mu.Unlock()
		if err := v.peer.Close(); err != nil {
			slog.Debug("close WebRTC peer after connection timeout", "error", err)
		}
	})
}

func (v *dataChannelValidator) add(channel *pion.DataChannel) bool {
	if !expectedDataChannel(channel.Label(), channel.Ordered(), channel.MaxRetransmits(), channel.MaxPacketLifeTime()) {
		v.reject()
		return false
	}

	v.mu.Lock()
	_, duplicate := v.seen[channel.Label()]
	if !v.rejected && !duplicate {
		v.seen[channel.Label()] = struct{}{}
		if len(v.seen) == len(expectedDataChannels) && v.timer != nil {
			v.timer.Stop()
		}
	}
	rejected := v.rejected || duplicate
	v.mu.Unlock()
	if rejected {
		v.reject()
	}
	return !rejected
}

func (v *dataChannelValidator) connectionStateChanged(state pion.PeerConnectionState) {
	v.mu.Lock()
	defer v.mu.Unlock()
	if state == pion.PeerConnectionStateConnected || state == pion.PeerConnectionStateClosed {
		v.connected = true
		if v.connectionTimer != nil {
			v.connectionTimer.Stop()
		}
	}
	if state == pion.PeerConnectionStateConnected && len(v.seen) != len(expectedDataChannels) && v.timer == nil && !v.rejected {
		v.timer = time.AfterFunc(dataChannelDeclarationTimeout, v.expire)
	}
	if state == pion.PeerConnectionStateClosed && v.timer != nil {
		v.timer.Stop()
	}
}

func (v *dataChannelValidator) expire() {
	v.mu.Lock()
	complete := len(v.seen) == len(expectedDataChannels) || v.rejected
	v.mu.Unlock()
	if !complete {
		v.reject()
	}
}

func (v *dataChannelValidator) reject() {
	v.mu.Lock()
	if v.rejected {
		v.mu.Unlock()
		return
	}
	v.rejected = true
	if v.timer != nil {
		v.timer.Stop()
	}
	if v.connectionTimer != nil {
		v.connectionTimer.Stop()
	}
	v.mu.Unlock()

	if err := v.peer.Close(); err != nil {
		slog.Debug("close WebRTC peer with invalid data channels", "error", err)
	}
}

func expectedDataChannel(label string, ordered bool, maxRetransmits, maxPacketLifeTime *uint16) bool {
	expected, ok := expectedDataChannels[label]
	return ok &&
		ordered == expected.ordered &&
		equalUint16Pointers(maxRetransmits, expected.maxRetransmits) &&
		maxPacketLifeTime == nil
}

func equalUint16Pointers(left, right *uint16) bool {
	return left == nil && right == nil || left != nil && right != nil && *left == *right
}

func (s *Server) removePeer(peer *pion.PeerConnection) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if p := s.players[peer]; p != nil {
		s.leave(p)
		if p.accountID != "" && s.accounts[p.accountID] == peer {
			delete(s.accounts, p.accountID)
		}
		delete(s.players, peer)
	}
}

// DisconnectAccount revokes the account's active connection, if any.
func (s *Server) DisconnectAccount(accountID string) {
	s.mu.Lock()
	peer := s.accounts[accountID]
	s.mu.Unlock()
	if peer != nil {
		s.removePeer(peer)
		if err := peer.Close(); err != nil {
			slog.Debug("close WebRTC peer after logout", "error", err)
		}
	}
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
