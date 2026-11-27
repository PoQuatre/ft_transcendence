package chat

import (
	"context"
	"sync"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

type Service struct {
	repo    Repository
	mu      sync.RWMutex
	clients map[uuid.UUID]*clientConn
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
		_ = old.conn.Close()
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
		_ = client.conn.Close()
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
		_ = target.send(msg)
	}
}
