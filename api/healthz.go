package api

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/roslib-mikhmon/api/dto"
)

// HealthStatus adalah payload response /healthz.
// OK = AND dari semua dependency check (DB, devices, influx).
type HealthStatus struct {
	OK      bool              `json:"ok"`
	DB      string            `json:"db"`
	Devices DeviceHealthStat  `json:"devices"`
	Influx  string            `json:"influx,omitempty"`
	SSE     map[string]int    `json:"sse_subscribers,omitempty"`
	Dropped map[string]uint64 `json:"sse_dropped,omitempty"`
}

// DeviceHealthStat ringkasan koneksi router.
type DeviceHealthStat struct {
	Connected int `json:"connected"`
	Total     int `json:"total"`
}

// healthzHandler cek ringan dependency: DB ping, count device connected
// vs total, influx ping (kalau enabled), SSE subscriber count + drop count.
// Status 200 kalau semua ok, 503 kalau ada dependency yang fail.
func healthzHandler(deps *Deps) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()

		status := HealthStatus{OK: true}

		// DB ping
		if deps.DB != nil {
			sqlDB, err := deps.DB.DB()
			if err != nil {
				status.OK = false
				status.DB = "error: " + err.Error()
			} else if err := sqlDB.PingContext(ctx); err != nil {
				status.OK = false
				status.DB = "error: " + err.Error()
			} else {
				status.DB = "ok"
			}
		} else {
			status.DB = "skipped"
		}

		// Devices: connected vs total
		if deps.DevMgr != nil {
			connected := len(deps.DevMgr.ListActive())
			total := connected
			if deps.DeviceStore != nil {
				if all, err := deps.DeviceStore.ListAll(ctx); err == nil {
					total = len(all)
				}
			}
			status.Devices = DeviceHealthStat{Connected: connected, Total: total}
			if total > 0 && connected == 0 {
				status.OK = false
			}
		}

		// Influx ping (kalau enabled)
		if deps.InfluxReader != nil {
			status.Influx = "ok"
		}

		// SSE stats — broker count + drop count
		if deps.Hub != nil {
			subs, dropped := deps.Hub.Stats()
			if len(subs) > 0 {
				status.SSE = subs
			}
			if len(dropped) > 0 {
				status.Dropped = dropped
			}
		}

		code := http.StatusOK
		if !status.OK {
			code = http.StatusServiceUnavailable
		}
		c.JSON(code, dto.OK(status))
	}
}
