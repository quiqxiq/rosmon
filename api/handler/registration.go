package handler

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/api/middleware"
	"github.com/quiqxiq/rosmon/service/audit"
	"github.com/quiqxiq/rosmon/service/billing"
	"github.com/quiqxiq/rosmon/service/notification"
	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/sirupsen/logrus"
)

// Registrations menangani alur registrasi pemasangan: submit publik → antrian
// admin → approve/reject/assign → operator complete-install (subscription +
// invoice pertama). Provisioning router lewat outbox (SyncStatus=pending_create).
type Registrations struct {
	Store        store.RegistrationStore
	Customers    store.CustomerStore
	Subs         store.SubscriptionStore
	Billing      *billing.Service
	Notification *notification.Service
	Settings     store.SettingStore
	Audit        store.AuditLogStore
	Log          *logrus.Logger
}

func NewRegistrations(
	regStore store.RegistrationStore,
	custStore store.CustomerStore,
	subStore store.SubscriptionStore,
	billingSvc *billing.Service,
	notif *notification.Service,
	settings store.SettingStore,
	auditStore store.AuditLogStore,
	log *logrus.Logger,
) *Registrations {
	if log == nil {
		log = logrus.New()
	}
	return &Registrations{
		Store: regStore, Customers: custStore, Subs: subStore,
		Billing: billingSvc, Notification: notif, Settings: settings,
		Audit: auditStore, Log: log,
	}
}

// RegisterPublic memasang endpoint publik (tanpa auth). Dipanggil di zone publik.
func (h *Registrations) RegisterPublic(g *gin.RouterGroup) {
	g.POST("/public/registrations", h.SubmitPublic)
}

// RegisterStaff memasang endpoint staff (admin+operator).
func (h *Registrations) RegisterStaff(g *gin.RouterGroup) {
	r := g.Group("/registrations")
	r.GET("", h.List)
	r.GET("/:id", h.Get)
	r.POST("/:id/approve", h.Approve)
	r.POST("/:id/reject", h.Reject)
	r.PUT("/:id/assign", h.Assign)
	r.POST("/:id/complete-install", h.CompleteInstall)
}

// ── Public ────────────────────────────────────────────────────────────────

func (h *Registrations) SubmitPublic(c *gin.Context) {
	var req dto.RegistrationCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	reg := &model.CustomerRegistration{
		FullName:         req.FullName,
		Phone:            req.Phone,
		Address:          req.Address,
		Area:             req.Area,
		Notes:            req.Notes,
		ServiceType:      req.ServiceType,
		PPPProfileID:     req.PPPProfileID,
		HotspotProfileID: req.HotspotProfileID,
		DeviceID:         req.DeviceID,
		Status:           "pending",
	}
	if err := h.Store.Create(c.Request.Context(), reg); err != nil {
		WriteErr(c, err)
		return
	}
	h.notifyAdmin(c.Request.Context(), "registration_received", map[string]string{
		"customer_name": reg.FullName,
		"phone":         reg.Phone,
		"address":       reg.Address,
		"area":          reg.Area,
	})
	WriteCreated(c, dto.FromModelRegistration(*reg))
}

// ── Staff: read ───────────────────────────────────────────────────────────

func (h *Registrations) List(c *gin.Context) {
	items, err := h.Store.List(c.Request.Context(), store.RegistrationListFilter{Status: c.Query("status")})
	if err != nil {
		WriteErr(c, err)
		return
	}
	out := make([]dto.RegistrationResponse, len(items))
	for i, it := range items {
		out[i] = dto.FromModelRegistration(it)
	}
	WriteList(c, out, len(out))
}

func (h *Registrations) Get(c *gin.Context) {
	id, ok := parseRegID(c)
	if !ok {
		return
	}
	reg, err := h.Store.Get(c.Request.Context(), id)
	if err != nil {
		h.writeErr(c, err)
		return
	}
	WriteOK(c, dto.FromModelRegistration(reg))
}

// ── Staff: approve / reject / assign ──────────────────────────────────────

func (h *Registrations) Approve(c *gin.Context) {
	id, ok := parseRegID(c)
	if !ok {
		return
	}
	var req dto.RegistrationApproveRequest
	_ = c.ShouldBindJSON(&req) // body opsional

	ctx := c.Request.Context()
	reg, err := h.Store.Get(ctx, id)
	if err != nil {
		h.writeErr(c, err)
		return
	}
	if reg.Status != "pending" {
		c.AbortWithStatusJSON(http.StatusConflict,
			dto.Err("CONFLICT", "registration is not pending", c.Request.URL.Path))
		return
	}

	// Cari customer existing by phone, atau buat baru.
	cust, err := h.Customers.GetByPhone(ctx, reg.Phone)
	if errors.Is(err, store.ErrCustomerNotFound) {
		newCust := &model.Customer{
			FullName: reg.FullName, Phone: reg.Phone, Address: reg.Address,
			Area: reg.Area, Notes: reg.Notes, Status: "aktif",
		}
		if claims, okC := middleware.ClaimsFrom(c); okC {
			uid := claims.UserID
			newCust.CreatedBy = &uid
		}
		if cErr := h.Customers.Create(ctx, newCust); cErr != nil {
			WriteErr(c, cErr)
			return
		}
		cust = *newCust
	} else if err != nil {
		WriteErr(c, err)
		return
	}

	old := reg
	now := time.Now()
	reg.Status = "approved"
	reg.CustomerID = &cust.ID
	reg.ReviewedAt = &now
	if req.ScheduledAt != nil {
		reg.ScheduledAt = req.ScheduledAt
	}
	if claims, okC := middleware.ClaimsFrom(c); okC {
		uid := claims.UserID
		reg.ReviewedBy = &uid
	}
	if err := h.Store.Update(ctx, &reg); err != nil {
		WriteErr(c, err)
		return
	}
	h.audit(c, "approve_registration", reg.ID, old, reg)

	schedule := "akan dijadwalkan"
	if reg.ScheduledAt != nil {
		schedule = reg.ScheduledAt.Format("02 Jan 2006 15:04")
	}
	h.notifyCustomer(ctx, cust, "registration_approved", map[string]string{"schedule": schedule})
	WriteOK(c, dto.FromModelRegistration(reg))
}

func (h *Registrations) Reject(c *gin.Context) {
	id, ok := parseRegID(c)
	if !ok {
		return
	}
	var req dto.RegistrationRejectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	ctx := c.Request.Context()
	reg, err := h.Store.Get(ctx, id)
	if err != nil {
		h.writeErr(c, err)
		return
	}
	if reg.Status != "pending" {
		c.AbortWithStatusJSON(http.StatusConflict,
			dto.Err("CONFLICT", "registration is not pending", c.Request.URL.Path))
		return
	}

	old := reg
	now := time.Now()
	reg.Status = "rejected"
	reg.RejectionReason = req.Reason
	reg.ReviewedAt = &now
	if claims, okC := middleware.ClaimsFrom(c); okC {
		uid := claims.UserID
		reg.ReviewedBy = &uid
	}
	if err := h.Store.Update(ctx, &reg); err != nil {
		WriteErr(c, err)
		return
	}
	h.audit(c, "reject_registration", reg.ID, old, reg)

	// Calon pelanggan belum tentu jadi Customer — kirim by phone.
	h.notifyPhone(ctx, nil, reg.Phone, "registration_rejected", map[string]string{
		"customer_name": reg.FullName,
		"reason":        req.Reason,
	})
	WriteOK(c, dto.FromModelRegistration(reg))
}

func (h *Registrations) Assign(c *gin.Context) {
	id, ok := parseRegID(c)
	if !ok {
		return
	}
	var req dto.RegistrationAssignRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	ctx := c.Request.Context()
	reg, err := h.Store.Get(ctx, id)
	if err != nil {
		h.writeErr(c, err)
		return
	}
	aid := req.AssignedTo
	reg.AssignedTo = &aid
	if req.ScheduledAt != nil {
		reg.ScheduledAt = req.ScheduledAt
	}
	if err := h.Store.Update(ctx, &reg); err != nil {
		WriteErr(c, err)
		return
	}
	WriteOK(c, dto.FromModelRegistration(reg))
}

// ── Staff: complete-install ───────────────────────────────────────────────

func (h *Registrations) CompleteInstall(c *gin.Context) {
	id, ok := parseRegID(c)
	if !ok {
		return
	}
	var req dto.RegistrationCompleteInstallRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	// Validasi pasangan profile sesuai service_type.
	if req.ServiceType == "pppoe" && req.PPPProfileID == nil {
		c.AbortWithStatusJSON(http.StatusBadRequest,
			dto.Err("INVALID_ARGUMENT", "ppp_profile_id required for pppoe", c.Request.URL.Path))
		return
	}
	if req.ServiceType == "hotspot" && req.HotspotProfileID == nil {
		c.AbortWithStatusJSON(http.StatusBadRequest,
			dto.Err("INVALID_ARGUMENT", "hotspot_profile_id required for hotspot", c.Request.URL.Path))
		return
	}

	ctx := c.Request.Context()
	reg, err := h.Store.Get(ctx, id)
	if err != nil {
		h.writeErr(c, err)
		return
	}
	if reg.Status != "approved" || reg.CustomerID == nil {
		c.AbortWithStatusJSON(http.StatusConflict,
			dto.Err("CONFLICT", "registration must be approved with a customer before install", c.Request.URL.Path))
		return
	}

	// Buat subscription aktif; provisioning ke router lewat outbox (pending_create).
	today := time.Now().Truncate(24 * time.Hour)
	now := time.Now()
	sub := &model.Subscription{
		CustomerID:       *reg.CustomerID,
		DeviceID:         req.DeviceID,
		PPPProfileID:     req.PPPProfileID,
		HotspotProfileID: req.HotspotProfileID,
		ServiceType:      req.ServiceType,
		MikrotikUsername: req.MikrotikUsername,
		MikrotikPassword: req.MikrotikPassword,
		BillingDay:       req.BillingDay,
		Status:           "active",
		SyncStatus:       "pending_create",
		ActivatedAt:      &now,
		NextInvoiceDate:  &today,
	}
	if err := h.Subs.Create(ctx, sub); err != nil {
		if errors.Is(err, store.ErrSubscriptionUsernameTaken) {
			c.AbortWithStatusJSON(http.StatusConflict,
				dto.Err("CONFLICT", "mikrotik_username already used on this device", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}

	// Invoice pertama (best-effort; cron akan menutupi kalau gagal).
	resp := gin.H{"subscription": dto.FromModelSubscription(*sub)}
	if h.Billing != nil {
		dueDays := h.settingInt(ctx, "billing.invoice_due_days", 7)
		if inv, bErr := h.Billing.GenerateForSubscription(ctx, *sub, today, dueDays); bErr != nil {
			h.Log.WithError(bErr).WithField("subscription_id", sub.ID).Warn("complete-install: first invoice failed")
		} else {
			resp["invoice"] = dto.FromModelInvoice(*inv)
		}
	}
	// Geser jadwal tagih berikutnya +1 bulan (periode ini sudah ditagih).
	next := today.AddDate(0, 1, 0)
	sub.NextInvoiceDate = &next
	if err := h.Subs.Update(ctx, sub); err != nil {
		h.Log.WithError(err).WithField("subscription_id", sub.ID).Warn("complete-install: advance next_invoice_date failed")
	}

	old := reg
	reg.InstalledAt = &now
	if err := h.Store.Update(ctx, &reg); err != nil {
		h.Log.WithError(err).WithField("registration_id", reg.ID).Warn("complete-install: update registration failed")
	}
	h.audit(c, "complete_install", reg.ID, old, reg)

	if cust, cErr := h.Customers.Get(ctx, *reg.CustomerID); cErr == nil {
		h.notifyCustomer(ctx, cust, "installation_complete", map[string]string{
			"username": sub.MikrotikUsername,
			"password": req.MikrotikPassword,
		})
	}
	c.JSON(http.StatusCreated, dto.OK(resp))
}

// ── helpers ───────────────────────────────────────────────────────────────

func (h *Registrations) notifyPhone(ctx context.Context, customerID *uint, phone, slug string, extra map[string]string) {
	if h.Notification == nil || phone == "" {
		return
	}
	vars := map[string]string{"company_name": h.setting(ctx, "general.company_name", "")}
	for k, v := range extra {
		vars[k] = v
	}
	h.Notification.NotifyAsync(customerID, phone, slug, vars)
}

func (h *Registrations) notifyCustomer(ctx context.Context, cust model.Customer, slug string, extra map[string]string) {
	vars := map[string]string{"customer_name": cust.FullName}
	for k, v := range extra {
		vars[k] = v
	}
	cid := cust.ID
	h.notifyPhone(ctx, &cid, cust.Phone, slug, vars)
}

func (h *Registrations) notifyAdmin(ctx context.Context, slug string, extra map[string]string) {
	h.notifyPhone(ctx, nil, h.setting(ctx, "notification.admin_phone", ""), slug, extra)
}

func (h *Registrations) setting(ctx context.Context, key, def string) string {
	if h.Settings == nil {
		return def
	}
	v, err := h.Settings.Get(ctx, key)
	if err != nil || v == "" {
		return def
	}
	return v
}

func (h *Registrations) settingInt(ctx context.Context, key string, def int) int {
	v := h.setting(ctx, key, "")
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return def
	}
	return n
}

func (h *Registrations) audit(c *gin.Context, action string, entityID uint, oldV, newV any) {
	var uid *uint
	if claims, ok := middleware.ClaimsFrom(c); ok {
		u := claims.UserID
		uid = &u
	}
	audit.Log(c.Request.Context(), h.Audit, h.Log, uid, action, "CustomerRegistration", entityID, oldV, newV)
}

func (h *Registrations) writeErr(c *gin.Context, err error) {
	if errors.Is(err, store.ErrRegistrationNotFound) {
		c.AbortWithStatusJSON(http.StatusNotFound,
			dto.Err("NOT_FOUND", "registration not found", c.Request.URL.Path))
		return
	}
	WriteErr(c, err)
}

func parseRegID(c *gin.Context) (uint, bool) {
	raw := c.Param("id")
	n, err := strconv.ParseUint(raw, 10, 64)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest,
			dto.Err("INVALID_ID", "invalid registration id", raw))
		return 0, false
	}
	return uint(n), true
}
