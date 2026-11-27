package auth

import (
	"sync"
	"time"
)

const (
	apiKeyLimit  = 60
	apiKeyWindow = time.Minute
)

type rateWindow struct {
	times [apiKeyLimit]time.Time
	next  int
	count int
}

type rateLimiter struct {
	lastCleanup time.Time
	entries     map[string]*rateWindow
	now         func() time.Time
	mu          sync.Mutex
}

func (l *rateLimiter) allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	if l.entries == nil {
		l.entries = make(map[string]*rateWindow)
	}
	if now.Sub(l.lastCleanup) >= apiKeyWindow {
		for id, window := range l.entries {
			last := window.times[(window.next+apiKeyLimit-1)%apiKeyLimit]
			if !now.Before(last.Add(apiKeyWindow)) {
				delete(l.entries, id)
			}
		}
		l.lastCleanup = now
	}
	window := l.entries[key]
	if window == nil {
		window = &rateWindow{}
		l.entries[key] = window
	}
	allowed := window.count < apiKeyLimit || !now.Before(window.times[window.next].Add(apiKeyWindow))
	window.times[window.next] = now
	window.next = (window.next + 1) % apiKeyLimit
	if window.count < apiKeyLimit {
		window.count++
	}
	return allowed
}
