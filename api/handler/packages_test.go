package handler_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/api/handler"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPublicPackages_ListOnlyPublicActive(t *testing.T) {
	gin.SetMode(gin.TestMode)

	ppp := newFakePPPStore()
	ppp.rows[1] = model.PPPProfile{ID: 1, DeviceID: 1, Name: "Home 10Mbps", PriceMonthly: 150000, RateLimit: "10M/10M", Description: "paket rumahan", IsPublic: true, Active: true}
	ppp.rows[2] = model.PPPProfile{ID: 2, DeviceID: 1, Name: "Internal", PriceMonthly: 0, IsPublic: false, Active: true}  // not public
	ppp.rows[3] = model.PPPProfile{ID: 3, DeviceID: 1, Name: "Lawas", PriceMonthly: 99000, IsPublic: true, Active: false} // inactive

	hs := newFakeProfileConfigStore()
	seedHotspot := func(id uint, name, role string, public, active bool) {
		p := &model.HotspotProfile{ID: id, DeviceID: 1, Name: name, Role: role, PriceMonthly: 50000, IsPublic: public, Active: active}
		hs.byID[id] = p
		hs.byKey[keyOf(1, name)] = p
	}
	seedHotspot(10, "Hotspot Bulanan", "permanent", true, true)
	seedHotspot(11, "Voucher 1d", "voucher", true, true) // voucher excluded
	seedHotspot(12, "Private", "permanent", false, true) // not public

	r := gin.New()
	handler.NewPublicPackages(ppp, hs).RegisterPublic(r.Group(""))

	req := httptest.NewRequest(http.MethodGet, "/public/packages", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)

	var body struct {
		Data []dto.PublicPackageResponse `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))

	// Expect exactly: ppp #1 (pppoe) + hotspot #10 (hotspot permanent).
	require.Len(t, body.Data, 2)

	byName := map[string]dto.PublicPackageResponse{}
	for _, p := range body.Data {
		byName[p.Name] = p
	}
	require.Contains(t, byName, "Home 10Mbps")
	assert.Equal(t, "pppoe", byName["Home 10Mbps"].ServiceType)
	assert.EqualValues(t, 150000, byName["Home 10Mbps"].Price)
	assert.Equal(t, "10M/10M", byName["Home 10Mbps"].RateLimit)

	require.Contains(t, byName, "Hotspot Bulanan")
	assert.Equal(t, "hotspot", byName["Hotspot Bulanan"].ServiceType)
	assert.EqualValues(t, 50000, byName["Hotspot Bulanan"].Price)

	assert.NotContains(t, byName, "Internal")
	assert.NotContains(t, byName, "Lawas")
	assert.NotContains(t, byName, "Voucher 1d")
	assert.NotContains(t, byName, "Private")
}

func TestPublicPackages_EmptyWhenNoneFlagged(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := gin.New()
	handler.NewPublicPackages(newFakePPPStore(), newFakeProfileConfigStore()).RegisterPublic(r.Group(""))

	req := httptest.NewRequest(http.MethodGet, "/public/packages", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var body struct {
		Data []dto.PublicPackageResponse `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Empty(t, body.Data)
}
