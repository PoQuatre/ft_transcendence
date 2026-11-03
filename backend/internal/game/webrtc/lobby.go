package webrtc

import (
	"encoding/json"
	"log/slog"

	"github.com/google/uuid"
	pion "github.com/pion/webrtc/v4"
)

// Identity is obtained from the authenticated signaling request, never from a client message.
type Identity struct {
	AccountID string
	Username  string
}

type player struct {
	lobby     *lobby
	channel   *pion.DataChannel
	ID        string `json:"id"`
	Username  string `json:"username"`
	accountID string
}

type lobby struct {
	id      string
	players []*player
}

type controlMessage struct {
	Type string `json:"type"`
}

func newPlayer(identity Identity) (*player, error) {
	id, err := uuid.NewRandom()
	if err != nil {
		return nil, err
	}
	name := identity.Username
	if identity.AccountID == "" {
		name = "Guest-" + id.String()[:8]
	}
	return &player{ID: id.String(), Username: name, accountID: identity.AccountID}, nil
}

func (s *Server) control(peer *pion.PeerConnection, channel *pion.DataChannel, message pion.DataChannelMessage) {
	var request controlMessage
	if !message.IsString || len(message.Data) > 4096 || json.Unmarshal(message.Data, &request) != nil {
		sendControl(channel, map[string]any{"type": "Error", "error": "invalid control message"})
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	p := s.players[peer]
	if p == nil {
		return
	}
	p.channel = channel
	switch request.Type {
	case "QuickPlayRequest":
		if p.lobby == nil {
			var room *lobby
			for _, candidate := range s.lobbies {
				if len(candidate.players) < 8 {
					room = candidate
					break
				}
			}
			if room == nil {
				id, err := uuid.NewRandom()
				if err != nil {
					sendControl(channel, map[string]any{"type": "Error", "error": "could not create lobby"})
					return
				}
				room = &lobby{id: id.String()}
				s.lobbies = append(s.lobbies, room)
			}
			room.players = append(room.players, p)
			p.lobby = room
			s.broadcast(room)
		} else {
			sendState(channel, p.lobby)
		}
	case "LeaveGameRequest":
		s.leave(p)
		sendControl(channel, map[string]any{"type": "GameLeft"})
	default:
		sendControl(channel, map[string]any{"type": "Error", "error": "unknown control message"})
	}
}

// Called with s.mu held, including during disconnect cleanup.
func (s *Server) leave(p *player) {
	room := p.lobby
	if room == nil {
		return
	}
	p.lobby = nil
	for i, member := range room.players {
		if member == p {
			room.players = append(room.players[:i], room.players[i+1:]...)
			break
		}
	}
	if len(room.players) > 0 {
		s.broadcast(room)
		return
	}
	for i, candidate := range s.lobbies {
		if candidate == room {
			s.lobbies = append(s.lobbies[:i], s.lobbies[i+1:]...)
			break
		}
	}
}

func (s *Server) broadcast(room *lobby) {
	for _, p := range room.players {
		sendState(p.channel, room)
	}
}

func sendState(channel *pion.DataChannel, room *lobby) {
	sendControl(channel, map[string]any{"type": "LobbyState", "lobbyId": room.id, "players": room.players})
}

func sendControl(channel *pion.DataChannel, value any) {
	if channel == nil {
		return
	}
	data, err := json.Marshal(value)
	if err == nil {
		err = channel.SendText(string(data))
	}
	if err != nil {
		slog.Debug("send lobby control message", "error", err)
	}
}
