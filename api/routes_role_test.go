package api_test

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api"
	"github.com/quiqxiq/rosmon/internal/config"
	"github.com/quiqxiq/rosmon/service/auth"
	"github.com/quiqxiq/rosmon/store"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/require"
)

// dummyStore instances so route groups pass their `if deps.XXX != nil` checks in routes.go
type dummyCustomerStore struct{ store.CustomerStore }
type dummySubscriptionStore struct{ store.SubscriptionStore }
type dummySettingStore struct{ store.SettingStore }
type dummyInvoiceStore struct{ store.InvoiceStore }
type dummyPaymentStore struct{ store.PaymentStore }
type dummySequenceStore struct{ store.SequenceStore }
type dummyPPPProfileStore struct{ store.PPPProfileStore }
type dummyHotspotStore struct{ store.HotspotProfileStore }
type dummyQuickPrintStore struct{ store.QuickPrintStore }
type dummyAuditLogStore struct{ store.AuditLogStore }
type dummyTemplateStore struct{ store.TemplateStore }
type dummyNotificationLogStore struct{ store.NotificationLogStore }
type dummyRegistrationStore struct{ store.RegistrationStore }
type dummyTicketStore struct{ store.TicketStore }

func TestRolePermissions_ViewerIsBlockedOnAllMutations(t *testing.T) {
	gin.SetMode(gin.TestMode)
	log := logrus.New()
	log.SetLevel(logrus.PanicLevel)

	signer := auth.NewSigner("0123456789abcdef0123456789abcdef", 15*time.Minute, time.Hour)

	deps := &api.Deps{
		Logger:            log,
		HTTPConfig:        &config.HTTPConfig{},
		CustomerStore:     &dummyCustomerStore{},
		SubscriptionStore: &dummySubscriptionStore{},
		SettingStore:      &dummySettingStore{},
		InvoiceStore:      &dummyInvoiceStore{},
		PaymentStore:      &dummyPaymentStore{},
		SequenceStore:     &dummySequenceStore{},
		PPPProfileStore:   &dummyPPPProfileStore{},
		HotspotStore:      &dummyHotspotStore{},
		QuickPrintStore:   &dummyQuickPrintStore{},
		AuditLogStore:     &dummyAuditLogStore{},
		TemplateStore:     &dummyTemplateStore{},
		NotificationStore: &dummyNotificationLogStore{},
		RegistrationStore: &dummyRegistrationStore{},
		TicketStore:       &dummyTicketStore{},
		AuthService:       &auth.Service{},
		AuthSigner:        signer,
	}

	handler := api.NewServer(deps)

	viewerToken, err := signer.SignAccess(100, "viewer_user", auth.RoleViewer)
	require.NoError(t, err)
	require.NotEmpty(t, viewerToken)

	operatorToken, err := signer.SignAccess(200, "operator_user", auth.RoleOperator)
	require.NoError(t, err)

	mutatingEndpoints := []struct {
		method string
		path   string
	}{
		{http.MethodPost, "/api/v1/devices/1/hotspot/vouchers/generate"},
		{http.MethodPost, "/api/v1/devices/1/hotspot/users"},
		{http.MethodPut, "/api/v1/devices/1/hotspot/users/1"},
		{http.MethodDelete, "/api/v1/devices/1/hotspot/users/1"},
		{http.MethodPost, "/api/v1/devices/1/hotspot/users/bulk-delete"},
		{http.MethodPost, "/api/v1/devices/1/hotspot/profiles"},
		{http.MethodPut, "/api/v1/devices/1/hotspot/profiles/1"},
		{http.MethodDelete, "/api/v1/devices/1/hotspot/profiles/1"},
		{http.MethodDelete, "/api/v1/devices/1/hotspot/active/1"},
		{http.MethodPatch, "/api/v1/devices/1/hotspot/bindings/1/type"},
		{http.MethodDelete, "/api/v1/devices/1/hotspot/bindings/1"},
		{http.MethodPost, "/api/v1/devices/1/ppp/secrets"},
		{http.MethodPut, "/api/v1/devices/1/ppp/secrets/1"},
		{http.MethodDelete, "/api/v1/devices/1/ppp/secrets/1"},
		{http.MethodPost, "/api/v1/devices/1/ppp/profiles"},
		{http.MethodPut, "/api/v1/devices/1/ppp/profiles/1"},
		{http.MethodDelete, "/api/v1/devices/1/ppp/profiles/1"},
		{http.MethodDelete, "/api/v1/devices/1/ppp/active/1"},
		{http.MethodPost, "/api/v1/devices/1/network/pools"},
		{http.MethodDelete, "/api/v1/devices/1/network/pools/1"},
		{http.MethodDelete, "/api/v1/devices/1/network/arp/1"},
		{http.MethodDelete, "/api/v1/devices/1/network/dhcp-leases/1"},
		{http.MethodDelete, "/api/v1/devices/1/network/queues/1"},
		{http.MethodPost, "/api/v1/devices/1/system/scripts"},
		{http.MethodDelete, "/api/v1/devices/1/system/scripts/1"},
		{http.MethodPost, "/api/v1/devices/1/system/schedulers"},
		{http.MethodDelete, "/api/v1/devices/1/system/schedulers/1"},
		{http.MethodPost, "/api/v1/customers"},
		{http.MethodPut, "/api/v1/customers/1"},
		{http.MethodDelete, "/api/v1/customers/1"},
		{http.MethodPost, "/api/v1/subscriptions"},
		{http.MethodPut, "/api/v1/subscriptions/1"},
		{http.MethodDelete, "/api/v1/subscriptions/1"},
		{http.MethodPut, "/api/v1/settings/general.company_name"},
		{http.MethodPost, "/api/v1/payments"},
		{http.MethodPost, "/api/v1/payments/collect"},
		{http.MethodPost, "/api/v1/invoices/generate"},
	}

	for _, ep := range mutatingEndpoints {
		t.Run("Viewer_Blocked_"+ep.method+"_"+ep.path, func(t *testing.T) {
			req := httptest.NewRequest(ep.method, ep.path, bytes.NewBufferString("{}"))
			req.Header.Set("Authorization", "Bearer "+viewerToken)
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			handler.ServeHTTP(w, req)

			require.Equal(t, http.StatusForbidden, w.Code,
				"expected 403 Forbidden for viewer on %s %s, got %d. Body: %s",
				ep.method, ep.path, w.Code, w.Body.String())
		})
	}

	adminOnlyEndpoints := []struct {
		method string
		path   string
	}{
		{http.MethodPost, "/api/v1/auth/users"},
		{http.MethodGet, "/api/v1/auth/users"},
		{http.MethodPost, "/api/v1/devices"},
		{http.MethodDelete, "/api/v1/devices/1"},
		{http.MethodPost, "/api/v1/devices/1/system/reboot"},
		{http.MethodPost, "/api/v1/devices/1/system/shutdown"},
		{http.MethodGet, "/api/v1/audit-logs"},
		{http.MethodGet, "/api/v1/message-templates"},
		{http.MethodGet, "/api/v1/notifications"},
	}

	for _, ep := range adminOnlyEndpoints {
		t.Run("Operator_BlockedOnAdminOnly_"+ep.method+"_"+ep.path, func(t *testing.T) {
			req := httptest.NewRequest(ep.method, ep.path, bytes.NewBufferString("{}"))
			req.Header.Set("Authorization", "Bearer "+operatorToken)
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			handler.ServeHTTP(w, req)

			require.Equal(t, http.StatusForbidden, w.Code,
				"expected 403 Forbidden for operator on admin-only endpoint %s %s, got %d. Body: %s",
				ep.method, ep.path, w.Code, w.Body.String())
		})
	}
}
