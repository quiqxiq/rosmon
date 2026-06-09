package dto

import (
	"testing"

	"github.com/quiqxiq/rosmon/store/model"
)

// Regression: both profile response DTOs must surface is_public (a missing
// mapping in FromModelHotspotProfile shipped is_public=false to the client
// even when the row was public).
func TestFromModelProfiles_IsPublicMapped(t *testing.T) {
	ppp := FromModelPPPProfile(model.PPPProfile{ID: 1, IsPublic: true})
	if !ppp.IsPublic {
		t.Fatalf("PPPProfileResponse.IsPublic = false, want true")
	}

	hs := FromModelHotspotProfile(model.HotspotProfile{ID: 1, Role: "permanent", IsPublic: true})
	if !hs.IsPublic {
		t.Fatalf("HotspotProfileResponse.IsPublic = false, want true")
	}
}
