package webrtc

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/labstack/echo/v5"
	pion "github.com/pion/webrtc/v4"
)

func RegisterRoutes(group *echo.Group, server *Server) {
	group.POST("/offer", func(c *echo.Context) error {
		var offer pion.SessionDescription
		body := http.MaxBytesReader(c.Response(), c.Request().Body, 1<<18)
		if err := json.NewDecoder(body).Decode(&offer); err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "invalid SDP offer")
		}

		answer, err := server.Answer(c.Request().Context(), offer)
		if err != nil {
			switch answerErrorStatus(err) {
			case http.StatusBadRequest:
				if errors.Is(err, errMediaNotSupported) {
					return echo.NewHTTPError(http.StatusBadRequest, errMediaNotSupported.Error())
				}
				return echo.NewHTTPError(http.StatusBadRequest, "invalid SDP offer")
			case http.StatusServiceUnavailable:
				slog.Warn("WebRTC service unavailable", "error", err)
				return echo.NewHTTPError(http.StatusServiceUnavailable, "WebRTC service unavailable")
			default:
				slog.Error("answer WebRTC offer", "error", err)
				return echo.NewHTTPError(http.StatusInternalServerError, "internal server error")
			}
		}

		return c.JSON(http.StatusOK, answer)
	})
}

func answerErrorStatus(err error) int {
	switch {
	case errors.Is(err, errInvalidOffer):
		return http.StatusBadRequest
	case errors.Is(err, errServerClosed):
		return http.StatusServiceUnavailable
	default:
		return http.StatusInternalServerError
	}
}
