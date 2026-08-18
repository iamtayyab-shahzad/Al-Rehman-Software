package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestParseDateRange_WeekIsMondayStartKarachi(t *testing.T) {
	gin.SetMode(gin.TestMode)
	loc := businessLocation()
	ref := time.Date(2026, 8, 5, 15, 0, 0, 0, loc)

	now := ref
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	weekday := int(now.Weekday())
	offset := (weekday + 6) % 7
	start := startOfDay.AddDate(0, 0, -offset)
	end := start.AddDate(0, 0, 7)

	wantStart := time.Date(2026, 8, 3, 0, 0, 0, 0, loc)
	wantEnd := time.Date(2026, 8, 10, 0, 0, 0, 0, loc)
	if !start.Equal(wantStart) || !end.Equal(wantEnd) {
		t.Fatalf("week window want %v–%v got %v–%v", wantStart, wantEnd, start, end)
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/?range=week", nil)
	start2, end2, err := parseDateRange(c)
	if err != nil {
		t.Fatal(err)
	}
	if !end2.After(start2) {
		t.Fatalf("invalid window %v %v", start2, end2)
	}
	days := int(end2.Sub(start2).Hours() / 24)
	if days != 7 {
		t.Fatalf("week should be 7 days, got %d", days)
	}
}
