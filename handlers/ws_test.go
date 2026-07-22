package handlers

import (
	"strings"
	"testing"
	"time"
)

func TestChatRateLimitBlocksBurstAndAppliesCooldown(t *testing.T) {
	chatRatesMu.Lock()
	chatRates = make(map[int]*chatRateState)
	chatRatesMu.Unlock()

	now := time.Date(2026, 7, 22, 12, 0, 0, 0, time.UTC)
	for i := 0; i < chatBurstLimit; i++ {
		if allowed, _ := checkChatRateLimit(42, now.Add(time.Duration(i)*time.Second)); !allowed {
			t.Fatalf("message %d should be allowed", i+1)
		}
	}

	for i := 0; i < 2; i++ {
		if allowed, _ := checkChatRateLimit(42, now.Add(5*time.Second)); allowed {
			t.Fatal("burst message should be refused")
		}
	}
	allowed, message := checkChatRateLimit(42, now.Add(5*time.Second))
	if allowed || !strings.Contains(message, "paused for 3 seconds") {
		t.Fatalf("expected cooldown, got allowed=%v message=%q", allowed, message)
	}

	if allowed, _ := checkChatRateLimit(42, now.Add(6*time.Second)); allowed {
		t.Fatal("message should remain blocked during cooldown")
	}
	if allowed, _ := checkChatRateLimit(42, now.Add(9*time.Second)); !allowed {
		t.Fatal("message should be allowed after cooldown")
	}
}
