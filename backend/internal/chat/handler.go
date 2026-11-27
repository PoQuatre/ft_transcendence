// Package chat handles everything on live chat with WebRTC
package chat

import (
	"net/http"
	"time"

	"github.com/alexedwards/scs/v2"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v5"
)

const (
	maxMessageSize = 32 * 1024
	pingPeriod     = 25 * time.Second
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func RegisterRoutes(group *echo.Group, service *Service, sessionManager *scs.SessionManager) {
	group.GET("/ws", func(c *echo.Context) error {
		userID, err := uuid.Parse(sessionManager.GetString(c.Request().Context(), "user_id"))
		if err != nil {
			return echo.NewHTTPError(http.StatusUnauthorized, "unauthorized")
		}

		conn, err := upgrader.Upgrade(c.Response(), c.Request(), nil)
		if err != nil {
			return err
		}

		client := service.RegisterClient(userID, conn)
		defer func() {
			service.UnregisterClient(userID, client)
			_ = conn.Close()
		}()

		done := make(chan struct{})
		defer close(done)
		go func() {
			ticker := time.NewTicker(pingPeriod)
			defer ticker.Stop()
			for {
				select {
				case <-done:
					return
				case <-ticker.C:
					client.mu.Lock()
					_ = conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
					err := conn.WriteMessage(websocket.PingMessage, nil)
					client.mu.Unlock()
					if err != nil {
						return
					}
				}
			}
		}()

		conn.SetReadLimit(maxMessageSize)
		for {
			var msg SignalMessage
			if err := conn.ReadJSON(&msg); err != nil {
				break
			}

			switch msg.Type {
			case "offer", "answer", "ice-candidate":
				service.ForwardSignal(c.Request().Context(), userID, msg)
			}
		}

		return nil
	})
}
