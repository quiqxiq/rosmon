package handler

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/roslib-mikhmon/api/dto"
	"github.com/quiqxiq/roslib-mikhmon/mikrotik"
	"github.com/quiqxiq/roslib-mikhmon/mikrotik/hotspot"
	"github.com/quiqxiq/roslib-mikhmon/mikrotik/ppp"
	"github.com/quiqxiq/roslib-mikhmon/service/devmgr"
	"github.com/quiqxiq/roslib-mikhmon/store"
	"github.com/quiqxiq/roslib-mikhmon/store/model"
	"github.com/sirupsen/logrus"
)

// Subscriptions handler — top-level /subscriptions.
//
// DB-first: semua mutasi tulis ke DB dulu lalu best-effort propagate ke
// router (synchronous, 5s timeout). Kalau router offline atau push
// gagal, response berisi `warning` — DB tetap authoritative dan
// operator bisa retry via POST /:id/reconcile.
type Subscriptions struct {
	Store           store.SubscriptionStore
	CustomerStore   store.CustomerStore
	BandwidthStore  store.BandwidthProfileStore
	DevMgr          *devmgr.Manager
	Log             *logrus.Logger
}

func NewSubscriptions(
	subs store.SubscriptionStore,
	cust store.CustomerStore,
	bw store.BandwidthProfileStore,
	devMgr *devmgr.Manager,
	log *logrus.Logger,
) *Subscriptions {
	if log == nil {
		log = logrus.New()
	}
	return &Subscriptions{
		Store: subs, CustomerStore: cust, BandwidthStore: bw,
		DevMgr: devMgr, Log: log,
	}
}

func (h *Subscriptions) Register(g *gin.RouterGroup) {
	r := g.Group("/subscriptions")
	r.GET("", h.List)
	r.POST("", h.Create)
	r.GET("/:id", h.Get)
	r.PUT("/:id", h.Update)
	r.PATCH("/:id/status", h.PatchStatus)
	r.POST("/:id/reconcile", h.Reconcile)
	r.DELETE("/:id", h.Delete)
}

func (h *Subscriptions) List(c *gin.Context) {
	f := store.SubscriptionListFilter{
		Status:      c.Query("status"),
		ServiceType: c.Query("service_type"),
	}
	if v := c.Query("customer_id"); v != "" {
		if n, err := strconv.ParseUint(v, 10, 64); err == nil {
			f.CustomerID = uint(n)
		}
	}
	if v := c.Query("device_id"); v != "" {
		if n, err := strconv.ParseUint(v, 10, 64); err == nil {
			f.DeviceID = uint(n)
		}
	}
	items, err := h.Store.List(c.Request.Context(), f)
	if err != nil {
		WriteErr(c, err)
		return
	}
	out := make([]dto.SubscriptionResponse, len(items))
	for i, it := range items {
		out[i] = dto.FromModelSubscription(it)
	}
	WriteList(c, out, len(out))
}

func (h *Subscriptions) Get(c *gin.Context) {
	id, ok := parseSubID(c)
	if !ok {
		return
	}
	sub, err := h.Store.Get(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrSubscriptionNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound,
				dto.Err("NOT_FOUND", "subscription not found", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	WriteOK(c, dto.FromModelSubscription(sub))
}

func (h *Subscriptions) Create(c *gin.Context) {
	var req dto.SubscriptionCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}

	// Validasi: customer exists.
	if _, err := h.CustomerStore.Get(c.Request.Context(), req.CustomerID); err != nil {
		if errors.Is(err, store.ErrCustomerNotFound) {
			c.AbortWithStatusJSON(http.StatusBadRequest,
				dto.Err("INVALID_ARGUMENT", "customer not found", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}

	// Validasi: bandwidth_profile exists DAN service_type + device_id match.
	bp, err := h.BandwidthStore.Get(c.Request.Context(), req.BandwidthProfileID)
	if err != nil {
		if errors.Is(err, store.ErrBandwidthProfileNotFound) {
			c.AbortWithStatusJSON(http.StatusBadRequest,
				dto.Err("INVALID_ARGUMENT", "bandwidth profile not found", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	if bp.ServiceType != req.ServiceType {
		c.AbortWithStatusJSON(http.StatusBadRequest,
			dto.Err("INVALID_ARGUMENT",
				fmt.Sprintf("service_type mismatch: subscription=%s bandwidth_profile=%s", req.ServiceType, bp.ServiceType),
				c.Request.URL.Path))
		return
	}
	if bp.DeviceID != req.DeviceID {
		c.AbortWithStatusJSON(http.StatusBadRequest,
			dto.Err("INVALID_ARGUMENT", "bandwidth profile belongs to a different device", c.Request.URL.Path))
		return
	}

	sub := &model.Subscription{
		CustomerID:         req.CustomerID,
		DeviceID:           req.DeviceID,
		BandwidthProfileID: req.BandwidthProfileID,
		ServiceType:        req.ServiceType,
		MikrotikUsername:   req.MikrotikUsername,
		MikrotikPassword:   req.MikrotikPassword,
		Notes:              req.Notes,
		Status:             "pending_install",
	}
	if err := h.Store.Create(c.Request.Context(), sub); err != nil {
		if errors.Is(err, store.ErrSubscriptionUsernameTaken) {
			c.AbortWithStatusJSON(http.StatusConflict,
				dto.Err("CONFLICT", "mikrotik_username already used on this device", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}

	// Best-effort provision di router. Default: disabled=false (active),
	// karena create biasanya langsung dipakai. Status di DB tetap
	// pending_install — caller dapat PATCH ke active begitu confirmed.
	warning := h.tryProvisionOnRouter(c, *sub, bp.MikrotikProfileName, false)
	if warning == "" {
		// Sync sukses → naikkan status ke active otomatis dan set activated_at.
		now := time.Now()
		if err := h.Store.UpdateStatus(c.Request.Context(), sub.ID, "active", &now, nil); err == nil {
			sub.Status = "active"
			sub.ActivatedAt = &now
		}
	}

	c.JSON(http.StatusCreated, dto.OK(dto.SubscriptionWriteResponse{
		Subscription: dto.FromModelSubscription(*sub),
		Warning:      warning,
	}))
}

func (h *Subscriptions) Update(c *gin.Context) {
	id, ok := parseSubID(c)
	if !ok {
		return
	}
	var req dto.SubscriptionUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	sub, err := h.Store.Get(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrSubscriptionNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound,
				dto.Err("NOT_FOUND", "subscription not found", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}

	// Cek pindah bandwidth_profile.
	var newProfileName string
	if req.BandwidthProfileID != nil && *req.BandwidthProfileID != sub.BandwidthProfileID {
		bp, errBP := h.BandwidthStore.Get(c.Request.Context(), *req.BandwidthProfileID)
		if errBP != nil {
			if errors.Is(errBP, store.ErrBandwidthProfileNotFound) {
				c.AbortWithStatusJSON(http.StatusBadRequest,
					dto.Err("INVALID_ARGUMENT", "bandwidth profile not found", c.Request.URL.Path))
				return
			}
			WriteErr(c, errBP)
			return
		}
		if bp.ServiceType != sub.ServiceType || bp.DeviceID != sub.DeviceID {
			c.AbortWithStatusJSON(http.StatusBadRequest,
				dto.Err("INVALID_ARGUMENT", "bandwidth profile mismatch (service_type/device_id)", c.Request.URL.Path))
			return
		}
		newProfileName = bp.MikrotikProfileName
		sub.BandwidthProfileID = *req.BandwidthProfileID
	}
	if req.MikrotikPassword != nil {
		sub.MikrotikPassword = *req.MikrotikPassword
	}
	if req.Notes != nil {
		sub.Notes = *req.Notes
	}
	if err := h.Store.Update(c.Request.Context(), &sub); err != nil {
		WriteErr(c, err)
		return
	}

	// Best-effort propagate update ke router (password / profile change).
	warning := h.trySetOnRouter(c, sub, newProfileName)
	WriteOK(c, dto.SubscriptionWriteResponse{
		Subscription: dto.FromModelSubscription(sub),
		Warning:      warning,
	})
}

func (h *Subscriptions) Delete(c *gin.Context) {
	id, ok := parseSubID(c)
	if !ok {
		return
	}
	sub, err := h.Store.Get(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrSubscriptionNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound,
				dto.Err("NOT_FOUND", "subscription not found", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	if err := h.Store.Delete(c.Request.Context(), id); err != nil {
		WriteErr(c, err)
		return
	}
	warning := h.tryRemoveOnRouter(c, sub)
	if warning != "" {
		WriteOK(c, dto.SubscriptionWriteResponse{
			Subscription: dto.FromModelSubscription(sub),
			Warning:      warning,
		})
		return
	}
	WriteNoContent(c)
}

// PatchStatus mengubah status subscription + sync ke router (set
// disabled/enabled, atau remove untuk 'terminated').
func (h *Subscriptions) PatchStatus(c *gin.Context) {
	id, ok := parseSubID(c)
	if !ok {
		return
	}
	var req dto.SubscriptionStatusPatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	sub, err := h.Store.Get(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrSubscriptionNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound,
				dto.Err("NOT_FOUND", "subscription not found", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}

	// Update status di DB.
	var activatedAt, terminatedAt *time.Time
	now := time.Now()
	switch req.Status {
	case "active":
		if sub.ActivatedAt == nil {
			activatedAt = &now
		}
	case "terminated":
		terminatedAt = &now
	}
	if err := h.Store.UpdateStatus(c.Request.Context(), id, req.Status, activatedAt, terminatedAt); err != nil {
		WriteErr(c, err)
		return
	}
	sub.Status = req.Status
	if activatedAt != nil {
		sub.ActivatedAt = activatedAt
	}
	if terminatedAt != nil {
		sub.TerminatedAt = terminatedAt
	}

	// Sync ke router sesuai status target.
	warning := h.trySyncStatus(c, sub)
	WriteOK(c, dto.SubscriptionWriteResponse{
		Subscription: dto.FromModelSubscription(sub),
		Warning:      warning,
	})
}

// Reconcile — full re-push DB state ke router. Recovery kalau ada drift
// karena sync sebelumnya gagal. Idempotent: ensure-exists + ensure-attrs
// + ensure-disabled-matches-status.
func (h *Subscriptions) Reconcile(c *gin.Context) {
	id, ok := parseSubID(c)
	if !ok {
		return
	}
	sub, err := h.Store.Get(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrSubscriptionNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound,
				dto.Err("NOT_FOUND", "subscription not found", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	bp, err := h.BandwidthStore.Get(c.Request.Context(), sub.BandwidthProfileID)
	if err != nil {
		WriteErr(c, fmt.Errorf("fetch bandwidth profile: %w", err))
		return
	}
	cs, ok := h.lookupClientForSub(c, sub.DeviceID)
	if !ok {
		c.AbortWithStatusJSON(http.StatusServiceUnavailable,
			dto.Err("DEVICE_OFFLINE", "device not connected", c.Request.URL.Path))
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), propagateTimeout)
	defer cancel()

	disabled := statusDisabled(sub.Status)
	warning := h.ensureRouterState(ctx, cs, sub, bp.MikrotikProfileName, disabled)
	WriteOK(c, dto.SubscriptionWriteResponse{
		Subscription: dto.FromModelSubscription(sub),
		Warning:      warning,
	})
}

// ── Propagation helpers ─────────────────────────────────────────────────

// tryProvisionOnRouter create secret/user di router. Used by Create.
// Returns warning string (empty = success).
func (h *Subscriptions) tryProvisionOnRouter(c *gin.Context, sub model.Subscription, profileName string, disabled bool) string {
	cs, ok := h.lookupClientForSub(c, sub.DeviceID)
	if !ok {
		return "device offline — subscription saved locally only"
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), propagateTimeout)
	defer cancel()

	switch sub.ServiceType {
	case "pppoe":
		disPtr := &disabled
		_, err := cs.PPP.SecretAdd(ctx, ppp.SecretAddArgs{
			Name:     sub.MikrotikUsername,
			Password: sub.MikrotikPassword,
			Service:  "pppoe",
			Profile:  profileName,
			Disabled: disPtr,
			Comment:  subComment(sub),
		})
		return mapSubErr(err, sub)
	case "hotspot":
		disPtr := &disabled
		_, err := cs.Hot.UserAdd(ctx, hotspot.UserAddArgs{
			Name:     sub.MikrotikUsername,
			Password: sub.MikrotikPassword,
			Profile:  profileName,
			Server:   "all",
			Disabled: disPtr,
			Comment:  subComment(sub),
		})
		return mapSubErr(err, sub)
	default:
		return "unknown service_type"
	}
}

// trySetOnRouter — propagate Update (password/profile change). Lookup ID
// dulu via ByName; kalau secret/user belum ada di router, fallback create.
func (h *Subscriptions) trySetOnRouter(c *gin.Context, sub model.Subscription, newProfileName string) string {
	cs, ok := h.lookupClientForSub(c, sub.DeviceID)
	if !ok {
		return "device offline — subscription saved locally only"
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), propagateTimeout)
	defer cancel()

	switch sub.ServiceType {
	case "pppoe":
		rs, err := cs.PPP.SecretByName(ctx, sub.MikrotikUsername)
		if errors.Is(err, mikrotik.ErrNotFound) {
			// Belum ada → create.
			disabled := statusDisabled(sub.Status)
			return h.tryProvisionOnRouter(c, sub, newProfileName, disabled)
		}
		if err != nil {
			return mapSubErr(err, sub)
		}
		args := ppp.SecretSetArgs{ID: rs.ID, Password: sub.MikrotikPassword}
		if newProfileName != "" {
			args.Profile = newProfileName
		}
		return mapSubErr(cs.PPP.SecretSet(ctx, args), sub)
	case "hotspot":
		ru, err := cs.Hot.UserByName(ctx, sub.MikrotikUsername)
		if errors.Is(err, mikrotik.ErrNotFound) {
			disabled := statusDisabled(sub.Status)
			return h.tryProvisionOnRouter(c, sub, newProfileName, disabled)
		}
		if err != nil {
			return mapSubErr(err, sub)
		}
		args := hotspot.UserSetArgs{ID: ru.ID, Password: sub.MikrotikPassword}
		if newProfileName != "" {
			args.Profile = newProfileName
		}
		return mapSubErr(cs.Hot.UserSet(ctx, args), sub)
	}
	return ""
}

// tryRemoveOnRouter — hapus secret/user di router. Idempotent.
func (h *Subscriptions) tryRemoveOnRouter(c *gin.Context, sub model.Subscription) string {
	cs, ok := h.lookupClientForSub(c, sub.DeviceID)
	if !ok {
		return "device offline — subscription removed from DB only"
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), propagateTimeout)
	defer cancel()

	switch sub.ServiceType {
	case "pppoe":
		rs, err := cs.PPP.SecretByName(ctx, sub.MikrotikUsername)
		if errors.Is(err, mikrotik.ErrNotFound) {
			return ""
		}
		if err != nil {
			return mapSubErr(err, sub)
		}
		return mapSubErr(cs.PPP.SecretRemove(ctx, rs.ID), sub)
	case "hotspot":
		ru, err := cs.Hot.UserByName(ctx, sub.MikrotikUsername)
		if errors.Is(err, mikrotik.ErrNotFound) {
			return ""
		}
		if err != nil {
			return mapSubErr(err, sub)
		}
		return mapSubErr(cs.Hot.UserRemove(ctx, ru.ID), sub)
	}
	return ""
}

// trySyncStatus — sync field `disabled` di router sesuai status target.
// Untuk 'terminated' → remove. Untuk yang lain → set disabled/enabled.
func (h *Subscriptions) trySyncStatus(c *gin.Context, sub model.Subscription) string {
	if sub.Status == "terminated" {
		return h.tryRemoveOnRouter(c, sub)
	}
	cs, ok := h.lookupClientForSub(c, sub.DeviceID)
	if !ok {
		return "device offline — status updated locally only"
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), propagateTimeout)
	defer cancel()

	disabled := statusDisabled(sub.Status)
	switch sub.ServiceType {
	case "pppoe":
		rs, err := cs.PPP.SecretByName(ctx, sub.MikrotikUsername)
		if errors.Is(err, mikrotik.ErrNotFound) {
			return "secret not found on router — reconcile required"
		}
		if err != nil {
			return mapSubErr(err, sub)
		}
		return mapSubErr(cs.PPP.SecretSetDisabled(ctx, rs.ID, disabled), sub)
	case "hotspot":
		ru, err := cs.Hot.UserByName(ctx, sub.MikrotikUsername)
		if errors.Is(err, mikrotik.ErrNotFound) {
			return "user not found on router — reconcile required"
		}
		if err != nil {
			return mapSubErr(err, sub)
		}
		return mapSubErr(cs.Hot.UserSetDisabled(ctx, ru.ID, disabled), sub)
	}
	return ""
}

// ensureRouterState — reconcile path. Cari secret/user di router; kalau
// tidak ada → create; kalau ada → set attrs + disabled.
func (h *Subscriptions) ensureRouterState(ctx context.Context, cs *devmgr.ClientSet, sub model.Subscription, profileName string, disabled bool) string {
	switch sub.ServiceType {
	case "pppoe":
		rs, err := cs.PPP.SecretByName(ctx, sub.MikrotikUsername)
		if errors.Is(err, mikrotik.ErrNotFound) {
			disPtr := &disabled
			_, addErr := cs.PPP.SecretAdd(ctx, ppp.SecretAddArgs{
				Name: sub.MikrotikUsername, Password: sub.MikrotikPassword,
				Service: "pppoe", Profile: profileName,
				Disabled: disPtr, Comment: subComment(sub),
			})
			return mapSubErr(addErr, sub)
		}
		if err != nil {
			return mapSubErr(err, sub)
		}
		if err := cs.PPP.SecretSet(ctx, ppp.SecretSetArgs{
			ID: rs.ID, Password: sub.MikrotikPassword, Profile: profileName,
			Disabled: &disabled,
		}); err != nil {
			return mapSubErr(err, sub)
		}
		return ""
	case "hotspot":
		ru, err := cs.Hot.UserByName(ctx, sub.MikrotikUsername)
		if errors.Is(err, mikrotik.ErrNotFound) {
			disPtr := &disabled
			_, addErr := cs.Hot.UserAdd(ctx, hotspot.UserAddArgs{
				Name: sub.MikrotikUsername, Password: sub.MikrotikPassword,
				Profile: profileName, Server: "all",
				Disabled: disPtr, Comment: subComment(sub),
			})
			return mapSubErr(addErr, sub)
		}
		if err != nil {
			return mapSubErr(err, sub)
		}
		if err := cs.Hot.UserSet(ctx, hotspot.UserSetArgs{
			ID: ru.ID, Password: sub.MikrotikPassword, Profile: profileName,
			Disabled: &disabled,
		}); err != nil {
			return mapSubErr(err, sub)
		}
		return ""
	}
	return ""
}

func (h *Subscriptions) lookupClientForSub(c *gin.Context, deviceID uint) (*devmgr.ClientSet, bool) {
	if h.DevMgr == nil {
		return nil, false
	}
	cs, err := h.DevMgr.Get(deviceID)
	if err != nil {
		h.Log.WithError(err).WithField("device_id", deviceID).
			Debug("subscription: device offline, skip MikroTik propagate")
		return nil, false
	}
	return cs, true
}

// statusDisabled mapping status → disabled flag di router. 'active' =
// enabled (disabled=false). Selain itu disabled=true. 'terminated' tidak
// pakai disable — di-remove sepenuhnya.
func statusDisabled(status string) bool {
	return status != "active"
}

func mapSubErr(err error, sub model.Subscription) string {
	if err == nil {
		return ""
	}
	return fmt.Sprintf("%s/%s: %s", sub.ServiceType, sub.MikrotikUsername, err.Error())
}

func subComment(sub model.Subscription) string {
	if sub.Notes != "" {
		return sub.Notes
	}
	return fmt.Sprintf("rosmon sub#%d cust#%d", sub.ID, sub.CustomerID)
}

func parseSubID(c *gin.Context) (uint, bool) {
	raw := c.Param("id")
	n, err := strconv.ParseUint(raw, 10, 64)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest,
			dto.Err("INVALID_ID", "invalid subscription id", raw))
		return 0, false
	}
	return uint(n), true
}
