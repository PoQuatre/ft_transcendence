package webrtc

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/labstack/echo/v5"
	pion "github.com/pion/webrtc/v4"
)

const OfferPath = "/offer"

func RegisterRoutes(group *echo.Group, server *Server, identify func(*http.Request) (Identity, error)) {
	group.POST(OfferPath, func(c *echo.Context) error {
		identity, err := identify(c.Request())
		if err != nil {
			return err
		}
		var offer pion.SessionDescription
		body := http.MaxBytesReader(c.Response(), c.Request().Body, 1<<18)
		if decodeErr := json.NewDecoder(body).Decode(&offer); decodeErr != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "invalid SDP offer")
		}

		answer, err := server.answer(c.Request().Context(), offer, identity)
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
			case http.StatusConflict:
				return echo.NewHTTPError(http.StatusConflict, errAccountConnected.Error())
			case http.StatusGatewayTimeout:
				slog.Warn("WebRTC signaling timed out", "error", err)
				return echo.NewHTTPError(http.StatusGatewayTimeout, "WebRTC signaling timed out")
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
	case errors.Is(err, errAccountConnected):
		return http.StatusConflict
	case errors.Is(err, context.DeadlineExceeded):
		return http.StatusGatewayTimeout
	default:
		return http.StatusInternalServerError
	}
}
