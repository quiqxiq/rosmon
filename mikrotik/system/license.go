package system

import (
	"context"

	"github.com/quiqxiq/rosmon/domain"
)

// License → /system/license/print (analisis §1.1).
// Return software-id, nlevel, dan features.
func (c *Client) License(ctx context.Context) (domain.SystemLicense, error) {
	reply, err := c.dev.Path("/system/license").Print().
		Proplist("software-id", "nlevel", "features").
		Exec(ctx)
	if err != nil {
		return domain.SystemLicense{}, err
	}
	if len(reply.Rows) == 0 {
		return domain.SystemLicense{}, nil
	}
	fields := reply.Rows[0].Map()
	return domain.SystemLicense{
		SoftwareID: fields["software-id"],
		NLevel:     fields["nlevel"],
		Features:   fields["features"],
	}, nil
}
