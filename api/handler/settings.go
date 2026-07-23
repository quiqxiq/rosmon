package handler

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	paymentSvc "github.com/quiqxiq/rosmon/service/payment"
	"github.com/quiqxiq/rosmon/store"
)

// Settings handler — GET /settings, PUT /settings/:key,
// POST /settings/payment-gateway/test.
type Settings struct {
	Store store.SettingStore
}

func NewSettings(s store.SettingStore) *Settings {
	return &Settings{Store: s}
}

func (h *Settings) Register(g *gin.RouterGroup) {
	h.RegisterSplit(g, g)
}

func (h *Settings) RegisterSplit(readGroup, writeGroup *gin.RouterGroup) {
	r := readGroup.Group("/settings")
	r.GET("", h.List)

	w := writeGroup.Group("/settings")
	w.PUT("/:key", h.Update)
	// Test koneksi payment gateway — admin/operator only.
	w.POST("/payment-gateway/test", h.TestPaymentGateway)
}

// maskSecret menggantikan isi value secret dengan "•••••••• (configured)"
// atau "(not set)" agar tidak bocor ke client.
func maskSecret(val string) string {
	if strings.TrimSpace(val) == "" {
		return ""
	}
	return "••••••••"
}

type settingItem struct {
	Key         string `json:"key"`
	Value       string `json:"value"`
	ValueType   string `json:"value_type"`
	Description string `json:"description,omitempty"`
	GroupName   string `json:"group_name,omitempty"`
}

func (h *Settings) List(c *gin.Context) {
	items, err := h.Store.List(c.Request.Context())
	if err != nil {
		WriteErr(c, err)
		return
	}
	out := make([]settingItem, len(items))
	for i, s := range items {
		val := s.Value
		// Field secret tidak boleh dikembalikan ke client dalam bentuk plaintext.
		if s.ValueType == "secret" {
			val = maskSecret(s.Value)
		}
		out[i] = settingItem{
			Key:         s.Key,
			Value:       val,
			ValueType:   s.ValueType,
			Description: s.Description,
			GroupName:   s.GroupName,
		}
	}
	WriteList(c, out, len(out))
}

func (h *Settings) Update(c *gin.Context) {
	key := c.Param("key")
	var req struct {
		// Value sengaja TANPA binding:"required" — string kosong adalah nilai
		// yang sah untuk setting (mengosongkan company_name, admin_phone, dll).
		Value string `json:"value"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	if err := h.Store.Set(c.Request.Context(), key, req.Value); err != nil {
		if errors.Is(err, store.ErrSettingNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound,
				dto.Err("NOT_FOUND", "setting key not found", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}

	// Secret key tidak dikembalikan ke client.
	returnVal := req.Value
	if key == "payment.xendit_secret_key" || key == "payment.xendit_webhook_token" {
		returnVal = maskSecret(req.Value)
	}
	WriteOK(c, gin.H{"key": key, "value": returnVal})
}

// TestPaymentGateway melakukan test koneksi ke Xendit API menggunakan secret key
// yang tersimpan di system_settings. Mengembalikan status koneksi dan akun Xendit.
func (h *Settings) TestPaymentGateway(c *gin.Context) {
	ctx := c.Request.Context()
	secretKey, err := h.Store.Get(ctx, "payment.xendit_secret_key")
	if err != nil || strings.TrimSpace(secretKey) == "" {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"success": false,
			"message": "Secret key belum dikonfigurasi. Isi Payment Gateway Settings terlebih dahulu.",
		})
		return
	}

	webhookToken, _ := h.Store.Get(ctx, "payment.xendit_webhook_token")
	adapter := paymentSvc.NewXenditAdapter(secretKey, webhookToken, 0)
	if err := testXenditConnection(ctx, adapter); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "Koneksi gagal: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Koneksi ke Xendit berhasil.",
	})
}

// testXenditConnection melakukan ping ke Xendit API dengan membuat balance inquiry
// atau cukup listing payment methods (lightweight call).
func testXenditConnection(ctx context.Context, adapter *paymentSvc.XenditAdapter) error {
	return adapter.Ping(ctx)
}
