package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/handler"
	"github.com/quiqxiq/rosmon/api/middleware"
	"github.com/quiqxiq/rosmon/service/auth"
	"github.com/quiqxiq/rosmon/service/portal"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const portalSecret = "0123456789abcdef0123456789abcdef"

type portalEnv struct {
	r      *gin.Engine
	signer *auth.Signer
	cust   *fakeCustomerStore
	inv    *fakeInvoiceStore
	pay    *fakePaymentStore
	sub    *fakeSubscriptionStore
	portal *portal.CustomerAuth
}

func setupPortalEngine(t *testing.T) portalEnv {
	t.Helper()
	gin.SetMode(gin.TestMode)
	signer := auth.NewSigner(portalSecret, 0, 0)
	custS := newFakeCustomerStore()
	invS := newFakeInvoiceStore()
	payS := newFakePaymentStore()
	subS := newFakeSubStore()
	pa := portal.New(portal.Deps{Customers: custS, Hasher: auth.NewHasher(4), Signer: signer})

	r := gin.New()
	g := r.Group("/api")
	g.Use(middleware.RequireCustomerAuth(signer))
	handler.NewCustomerPortal(pa, custS, subS, invS, payS).Register(g)
	return portalEnv{r: r, signer: signer, cust: custS, inv: invS, pay: payS, sub: subS, portal: pa}
}

// authGET / authPOST attach a customer bearer token.
func authReq(r *gin.Engine, method, path, token string, body any) *httptest.ResponseRecorder {
	var buf bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&buf).Encode(body)
	}
	req := httptest.NewRequest(method, path, &buf)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func (e portalEnv) token(t *testing.T, customerID uint, phone string) string {
	t.Helper()
	tok, err := e.signer.SignCustomerAccess(customerID, phone)
	require.NoError(t, err)
	return tok
}

func TestPortal_Me_OK(t *testing.T) {
	e := setupPortalEngine(t)
	c := &model.Customer{FullName: "Pak Budi", Phone: "0811", Status: "aktif"}
	require.NoError(t, e.cust.Create(context.Background(), c))

	w := authReq(e.r, http.MethodGet, "/api/customer/me", e.token(t, c.ID, c.Phone), nil)
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())
	assert.Contains(t, w.Body.String(), `"full_name":"Pak Budi"`)
	assert.NotContains(t, w.Body.String(), "portal_password")
}

func TestPortal_NoToken_401(t *testing.T) {
	e := setupPortalEngine(t)
	w := authReq(e.r, http.MethodGet, "/api/customer/me", "", nil)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

// Staff token must be rejected by the customer portal.
func TestPortal_StaffToken_401(t *testing.T) {
	e := setupPortalEngine(t)
	staffTok, _ := e.signer.SignAccess(1, "admin", "admin")
	w := authReq(e.r, http.MethodGet, "/api/customer/me", staffTok, nil)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestPortal_Invoices_OnlyOwn(t *testing.T) {
	e := setupPortalEngine(t)
	// cust1 + cust2 invoices.
	e.inv.put(model.Invoice{CustomerID: 1, SubscriptionID: 1, Amount: 150000, Status: "issued", InvoiceNumber: "INV-1", PaymentCode: "CODE1ABCDE"})
	e.inv.put(model.Invoice{CustomerID: 2, SubscriptionID: 2, Amount: 99000, Status: "issued", InvoiceNumber: "INV-2", PaymentCode: "CODE2ABCDE"})

	w := authReq(e.r, http.MethodGet, "/api/customer/invoices", e.token(t, 1, "0811"), nil)
	require.Equal(t, http.StatusOK, w.Code)

	var body struct {
		Data []struct {
			InvoiceNumber string `json:"invoice_number"`
			PaymentCode   string `json:"payment_code"`
			QRContent     string `json:"qr_content"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	require.Len(t, body.Data, 1)
	assert.Equal(t, "INV-1", body.Data[0].InvoiceNumber)
	assert.Equal(t, "CODE1ABCDE", body.Data[0].PaymentCode)
	assert.Equal(t, "rosmon-pay:CODE1ABCDE", body.Data[0].QRContent)
}

func TestPortal_GetInvoice_OtherCustomer_404(t *testing.T) {
	e := setupPortalEngine(t)
	other := e.inv.put(model.Invoice{CustomerID: 2, SubscriptionID: 2, Amount: 99000, Status: "issued", InvoiceNumber: "INV-2", PaymentCode: "CODE2ABCDE"})
	// cust1 tries to read cust2's invoice.
	w := authReq(e.r, http.MethodGet, "/api/customer/invoices/"+strconv.FormatUint(uint64(other.ID), 10), e.token(t, 1, "0811"), nil)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestPortal_Payments_OnlyOwn(t *testing.T) {
	e := setupPortalEngine(t)
	_ = e.pay.Create(context.Background(), &model.Payment{InvoiceID: 1, CustomerID: 1, Amount: 150000, Method: "cash", Status: "confirmed"})
	_ = e.pay.Create(context.Background(), &model.Payment{InvoiceID: 2, CustomerID: 2, Amount: 99000, Method: "cash", Status: "confirmed"})

	w := authReq(e.r, http.MethodGet, "/api/customer/payments", e.token(t, 1, "0811"), nil)
	require.Equal(t, http.StatusOK, w.Code)
	var body struct {
		Data []struct {
			CustomerID uint `json:"customer_id"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	require.Len(t, body.Data, 1)
	assert.EqualValues(t, 1, body.Data[0].CustomerID)
}

func TestPortal_ChangePassword(t *testing.T) {
	e := setupPortalEngine(t)
	c := &model.Customer{FullName: "Pak Budi", Phone: "0811", Status: "aktif"}
	require.NoError(t, e.cust.Create(context.Background(), c))
	require.NoError(t, e.portal.SetPassword(context.Background(), c.ID, "oldpassword"))

	tok := e.token(t, c.ID, c.Phone)
	w := authReq(e.r, http.MethodPost, "/api/customer/change-password", tok, map[string]any{
		"old_password": "oldpassword", "new_password": "newpassword",
	})
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())

	// Wrong old password → 400.
	w2 := authReq(e.r, http.MethodPost, "/api/customer/change-password", tok, map[string]any{
		"old_password": "totallywrong", "new_password": "anotherpass",
	})
	assert.Equal(t, http.StatusBadRequest, w2.Code)
}
