package webrtc

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/labstack/echo/v5"
)

func TestAnswerErrorStatus(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want int
	}{
		{"invalid offer", errInvalidOffer, http.StatusBadRequest},
		{"service closed", errServerClosed, http.StatusServiceUnavailable},
		{"signaling timeout", context.DeadlineExceeded, http.StatusGatewayTimeout},
		{"unexpected", errors.New("unexpected"), http.StatusInternalServerError},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := answerErrorStatus(test.err); got != test.want {
				t.Errorf("answerErrorStatus() = %d, want %d", got, test.want)
			}
		})
	}
}

func TestOfferReturnsGatewayTimeoutForExpiredRequest(t *testing.T) {
	server, err := New(0, []string{})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if closeErr := server.Close(); closeErr != nil {
			t.Error(closeErr)
		}
	})

	e := echo.New()
	RegisterRoutes(e.Group("/api/webrtc"), server)
	ctx, cancel := context.WithDeadline(t.Context(), time.Now().Add(-time.Second))
	defer cancel()
	request := httptest.NewRequest(http.MethodPost, "/api/webrtc/offer", strings.NewReader(`{}`)).WithContext(ctx)
	response := httptest.NewRecorder()

	e.ServeHTTP(response, request)

	if response.Code != http.StatusGatewayTimeout {
		t.Errorf("POST /api/webrtc/offer status = %d, want %d", response.Code, http.StatusGatewayTimeout)
	}
}
