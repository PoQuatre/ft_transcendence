package webrtc

import (
	"errors"
	"net/http"
	"testing"
)

func TestAnswerErrorStatus(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want int
	}{
		{"invalid offer", errInvalidOffer, http.StatusBadRequest},
		{"service closed", errServerClosed, http.StatusServiceUnavailable},
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
