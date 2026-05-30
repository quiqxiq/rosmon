package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/store"
)

// PublicPackages — GET /public/packages (publik, tanpa auth).
// Mengembalikan paket layanan (PPPoE + Hotspot permanent) yang ditandai
// is_public, untuk form pendaftaran di landing page. Field sensitif tidak
// pernah dibocorkan (lihat dto.PublicPackageResponse).
type PublicPackages struct {
	PPP     store.PPPProfileStore
	Hotspot store.HotspotProfileStore
}

func NewPublicPackages(ppp store.PPPProfileStore, hs store.HotspotProfileStore) *PublicPackages {
	return &PublicPackages{PPP: ppp, Hotspot: hs}
}

func (h *PublicPackages) RegisterPublic(g *gin.RouterGroup) {
	g.GET("/public/packages", h.List)
}

func (h *PublicPackages) List(c *gin.Context) {
	ctx := c.Request.Context()
	out := []dto.PublicPackageResponse{}
	if h.PPP != nil {
		items, err := h.PPP.ListPublic(ctx)
		if err != nil {
			WriteErr(c, err)
			return
		}
		for _, p := range items {
			out = append(out, dto.PublicPackageFromPPP(p))
		}
	}
	if h.Hotspot != nil {
		items, err := h.Hotspot.ListPublic(ctx)
		if err != nil {
			WriteErr(c, err)
			return
		}
		for _, p := range items {
			out = append(out, dto.PublicPackageFromHotspot(p))
		}
	}
	WriteList(c, out, len(out))
}
