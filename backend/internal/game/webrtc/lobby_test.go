package webrtc

import (
	"errors"
	"testing"

	pion "github.com/pion/webrtc/v4"
)

func TestLobbyCapacityAndCleanup(t *testing.T) {
	s, err := New(0, nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if closeErr := s.Close(); closeErr != nil {
			t.Error(closeErr)
		}
	})
	peers := make([]*pion.PeerConnection, 9)
	for i := range peers {
		peers[i], err = s.api.NewPeerConnection(pion.Configuration{})
		if err != nil {
			t.Fatal(err)
		}
		p, err := newPlayer(Identity{})
		if err != nil {
			t.Fatal(err)
		}
		if err := s.managePlayer(peers[i], nil, p); err != nil {
			t.Fatal(err)
		}
		s.control(peers[i], nil, pion.DataChannelMessage{IsString: true, Data: []byte(`{"type":"QuickPlayRequest"}`)})
	}
	if len(s.lobbies) != 2 || len(s.lobbies[0].players) != 8 || len(s.lobbies[1].players) != 1 {
		t.Fatal("expected lobbies of 8 and 1")
	}
	s.control(peers[0], nil, pion.DataChannelMessage{IsString: true, Data: []byte(`{"type":"QuickPlayRequest"}`)})
	if len(s.lobbies[0].players) != 8 {
		t.Fatal("repeat quick play added a player")
	}
	s.control(peers[8], nil, pion.DataChannelMessage{IsString: true, Data: []byte(`{"type":"LeaveGameRequest"}`)})
	if len(s.lobbies) != 1 {
		t.Fatal("empty lobby not removed")
	}
	for _, peer := range peers[:8] {
		s.removePeer(peer)
	}
	if len(s.lobbies) != 0 {
		t.Fatal("disconnect did not clean up lobby")
	}
}

func TestDuplicateAccount(t *testing.T) {
	s, err := New(0, nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if closeErr := s.Close(); closeErr != nil {
			t.Error(closeErr)
		}
	})
	first, err := s.api.NewPeerConnection(pion.Configuration{})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if closeErr := first.Close(); closeErr != nil {
			t.Error(closeErr)
		}
	})
	second, err := s.api.NewPeerConnection(pion.Configuration{})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if closeErr := second.Close(); closeErr != nil {
			t.Error(closeErr)
		}
	})
	p, err := newPlayer(Identity{AccountID: "account", Username: "user"})
	if err != nil {
		t.Fatal(err)
	}
	if manageErr := s.managePlayer(first, nil, p); manageErr != nil {
		t.Fatal(manageErr)
	}
	other, err := newPlayer(Identity{AccountID: "account", Username: "user"})
	if err != nil {
		t.Fatal(err)
	}
	if manageErr := s.managePlayer(second, nil, other); !errors.Is(manageErr, errAccountConnected) {
		t.Fatalf("got %v", manageErr)
	}
	s.removePeer(first)
	if manageErr := s.managePlayer(second, nil, other); manageErr != nil {
		t.Fatal(manageErr)
	}
}

func TestDisconnectAccountRemovesLobbyPlayer(t *testing.T) {
	s, err := New(0, nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = s.Close() })
	peer, err := s.api.NewPeerConnection(pion.Configuration{})
	if err != nil {
		t.Fatal(err)
	}
	p, err := newPlayer(Identity{AccountID: "account", Username: "user"})
	if err != nil {
		t.Fatal(err)
	}
	if err := s.managePlayer(peer, nil, p); err != nil {
		t.Fatal(err)
	}
	s.control(peer, nil, pion.DataChannelMessage{IsString: true, Data: []byte(`{"type":"QuickPlayRequest"}`)})
	s.DisconnectAccount("account")
	if peer.ConnectionState() != pion.PeerConnectionStateClosed || len(s.lobbies) != 0 || len(s.players) != 0 || len(s.accounts) != 0 {
		t.Fatal("logout did not close and remove the account's lobby connection")
	}
}
