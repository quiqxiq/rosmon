package handler

import (
	"net/http"
	"strconv"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/roslib"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/mikrotik/system"
)

// PingCount meng-handle endpoint count-based ping ke RouterOS.
type PingCount struct{ Sys *system.Client }

// NewPingCount constructor.
func NewPingCount(sys *system.Client) *PingCount { return &PingCount{Sys: sys} }

// Register mount /ping di group device.
func (h *PingCount) Register(g *gin.RouterGroup) {
	mk := func(c *gin.Context) *PingCount { return NewPingCount(mustClients(c).Sys) }
	g.GET("/ping", func(c *gin.Context) { mk(c).Ping(c) })
}

// Ping menjalankan /ping address=<addr> count=<count> dan return summary.
func (h *PingCount) Ping(c *gin.Context) {
	address := c.Query("address")
	if address == "" {
		c.AbortWithStatusJSON(http.StatusBadRequest,
			dto.Err("VALIDATION", "address query param is required", c.Request.URL.Path))
		return
	}
	count := 5
	if v := c.Query("count"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			if n > 50 {
				n = 50
			}
			count = n
		}
	}

	summary, err := h.runPingCount(c, address, count)
	if err != nil {
		WriteErr(c, err)
		return
	}
	WriteOK(c, summary)
}

// runPingCount collect rows dari streaming /ping count=N, parse, dan assemble summary.
func (h *PingCount) runPingCount(c *gin.Context, address string, count int) (dto.PingSummary, error) {
	id := "ping-count:" + c.Param("device_id") + ":" + address + ":" + strconv.Itoa(count)

	var (
		mu        sync.Mutex
		results   []dto.PingResult
		summary   dto.PingSummary
		done      = make(chan struct{})
		errResult error
	)

	err := h.Sys.PingCount(id, address, count,
		func(sen *roslib.Sentence) {
			mu.Lock()
			defer mu.Unlock()
			if sen.Word() != "!re" {
				return
			}
			if sen.Get("sent") != "" {
				// Summary row
				summary.Target = address
				summary.Sent, _ = strconv.Atoi(sen.Get("sent"))
				summary.Received, _ = strconv.Atoi(sen.Get("received"))
				lossStr := sen.Get("packet-loss")
				if lossStr != "" {
					lossStr = strings.TrimSuffix(lossStr, "%")
					summary.PacketLossPercent, _ = strconv.ParseFloat(lossStr, 64)
				}
				summary.MinRttMs = parsePingTimeMs(sen.Get("min-rtt"))
				summary.AvgRttMs = parsePingTimeMs(sen.Get("avg-rtt"))
				summary.MaxRttMs = parsePingTimeMs(sen.Get("max-rtt"))
				return
			}
			// Result row
			seq, _ := strconv.Atoi(sen.Get("seq"))
			size, _ := strconv.Atoi(sen.Get("size"))
			ttl, _ := strconv.Atoi(sen.Get("ttl"))
			results = append(results, dto.PingResult{
				Seq:    seq,
				Host:   sen.Get("host"),
				Size:   size,
				TTL:    ttl,
				TimeMs: parsePingTimeMs(sen.Get("time")),
				Status: sen.Get("status"),
			})
		},
		func(_ string, err error) {
			if err != nil {
				errResult = err
			}
			close(done)
		},
	)
	if err != nil {
		return dto.PingSummary{}, err
	}

	select {
	case <-done:
	case <-c.Request.Context().Done():
		h.Sys.StopPingStream(id)
		return dto.PingSummary{}, c.Request.Context().Err()
	}

	h.Sys.StopPingStream(id)

	mu.Lock()
	defer mu.Unlock()
	summary.Results = results
	return summary, errResult
}

// parsePingTimeMs parse RouterOS time string: "24ms" (v6) atau "84ms435us" (v7).
// Return angka sebelum "ms" dalam float64.
func parsePingTimeMs(s string) float64 {
	if s == "" {
		return 0
	}
	for i := 0; i < len(s); i++ {
		if s[i] == 'm' && i+1 < len(s) && s[i+1] == 's' {
			if ms, err := strconv.ParseFloat(s[:i], 64); err == nil {
				return ms
			}
		}
	}
	return 0
}
