package middleware

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/service/devmgr"
)

// DeviceMiddleware membaca :device_id dari path, parse ke uint, mencari
// ClientSet dari DeviceManager, lalu menyimpannya ke context untuk diakses
// handler.
func DeviceMiddleware(mgr *devmgr.Manager) gin.HandlerFunc {
	return func(c *gin.Context) {
		raw := c.Param("device_id")
		id, err := strconv.ParseUint(raw, 10, 64)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest,
				dto.Err("INVALID_ID", "invalid device id", raw))
			return
		}
		cs, err := mgr.Get(uint(id))
		if err != nil {
			c.AbortWithStatusJSON(http.StatusNotFound,
				dto.Err("DEVICE_NOT_FOUND", "device not found or not connected", raw))
			return
		}
		// Import api package akan menyebabkan import cycle — gunakan key langsung
		c.Set("device_clients", cs)
		c.Next()
	}
}
