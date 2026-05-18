package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/roslib-mikhmon/api/dto"
	"github.com/quiqxiq/roslib-mikhmon/workflows"
)

// HotspotVoucher meng-handle /hotspot/vouchers — generator batch voucher
// untuk Quick Print di frontend (analisis §7).
type HotspotVoucher struct {
	WF *workflows.Clients
}

func NewHotspotVoucher(wf *workflows.Clients) *HotspotVoucher {
	return &HotspotVoucher{WF: wf}
}

func (h *HotspotVoucher) Register(g *gin.RouterGroup) {
	mk := func(c *gin.Context) *HotspotVoucher {
		cs := mustClients(c)
		return NewHotspotVoucher(cs.WF)
	}
	g.POST("/hotspot/vouchers/generate", func(c *gin.Context) { mk(c).Generate(c) })
}

// Generate POST /hotspot/vouchers/generate.
//
// Pakai workflows.GenerateVouchers. Kalau gagal di tengah, response 207
// (Multi-Status) — vouchers yang sudah berhasil tetap di-return supaya
// caller tahu state akhir + bisa rollback manual via bulk-delete.
func (h *HotspotVoucher) Generate(c *gin.Context) {
	var req dto.VoucherGenerateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}

	spec := req.ToDomain()
	created, err := workflows.GenerateVouchers(c.Request.Context(), h.WF, spec)

	if err != nil {
		// Partial failure → kembalikan vouchers yang sudah berhasil + warning.
		var partial *workflows.GenerateVouchersErr
		if errors.As(err, &partial) {
			c.JSON(http.StatusMultiStatus, dto.OK(dto.VoucherGenerateResponse{
				Vouchers: fromGenerated(partial.Created),
				Count:    len(partial.Created),
				Partial:  true,
				Error:    partial.Failed.Error(),
			}))
			return
		}
		// Validation error / ErrInvalidArgument
		WriteErr(c, err)
		return
	}

	WriteOK(c, dto.VoucherGenerateResponse{
		Vouchers: fromGenerated(created),
		Count:    len(created),
	})
}

func fromGenerated(in []workflows.GeneratedVoucher) []dto.VoucherResponse {
	out := make([]dto.VoucherResponse, len(in))
	for i, v := range in {
		out[i] = dto.VoucherResponse{ID: v.ID, Username: v.Username, Password: v.Password}
	}
	return out
}
