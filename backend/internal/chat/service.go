package chat

import (
	"context"
	"log/slog"
	"sync"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

type Service struct {
	clients map[uuid.UUID]*clientConn
	repo    Repository
	mu      sync.RWMutex
}

func NewService(repo Repository) *Service {
	return &Service{
		repo:    repo,
		clients: make(map[uuid.UUID]*clientConn),
	}
}

func (s *Service) RegisterClient(userID uuid.UUID, conn *websocket.Conn) *clientConn {
	client := &clientConn{conn: conn}
	s.mu.Lock()
	if old, ok := s.clients[userID]; ok {
		if err := old.conn.Close(); err != nil {
			slog.Debug("chat: failed to close replaced connection", "user_id", userID, "error", err)
		}
	}
	s.clients[userID] = client
	s.mu.Unlock()
	return client
}

func (s *Service) UnregisterClient(userID uuid.UUID, client *clientConn) {
	s.mu.Lock()
	if current, ok := s.clients[userID]; ok && current == client {
		delete(s.clients, userID)
	}
	s.mu.Unlock()
}

func (s *Service) DisconnectUser(userID uuid.UUID) {
	s.mu.Lock()
	client, ok := s.clients[userID]
	if ok {
		delete(s.clients, userID)
	}
	s.mu.Unlock()

	if ok {
		if err := client.conn.Close(); err != nil {
			slog.Debug("chat: failed to close connection on disconnect", "user_id", userID, "error", err)
		}
	}
}

func (s *Service) ForwardSignal(ctx context.Context, senderID uuid.UUID, msg SignalMessage) {
	if msg.TargetID == uuid.Nil || msg.TargetID == senderID {
		return
	}

	isFriend, err := s.repo.AreFriend(ctx, senderID, msg.TargetID)
	if err != nil || !isFriend {
		return
	}

	s.mu.RLock()
	target, online := s.clients[msg.TargetID]
	s.mu.RUnlock()

	if online {
		msg.SenderID = senderID
		if err := target.send(msg); err != nil {
			slog.Debug("chat: failed to forward signal", "target_id", msg.TargetID, "error", err)
		}
	}
}
