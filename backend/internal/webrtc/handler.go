package webrtc

import (
	"encoding/json"
	"errors"
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

		answer, err := server.Answer(offer)
		if err != nil {
			if errors.Is(err, errMediaNotSupported) {
				return echo.NewHTTPError(http.StatusBadRequest, err.Error())
			}
			return echo.NewHTTPError(http.StatusBadRequest, "invalid SDP offer")
		}

		return c.JSON(http.StatusOK, answer)
	})
}
