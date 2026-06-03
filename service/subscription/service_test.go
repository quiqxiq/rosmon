package subscription_test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	subsvc "github.com/quiqxiq/rosmon/service/subscription"
	"github.com/quiqxiq/rosmon/store/model"
)

// ── fakes ────────────────────────────────────────────────────────────────────

type fakePPPStore struct{ name string }

func (f *fakePPPStore) Get(_ context.Context, _ uint) (model.PPPProfile, error) {
	return model.PPPProfile{Name: f.name}, nil
}

type fakeHotspotStore struct{ name string }

func (f *fakeHotspotStore) Get(_ context.Context, _ uint) (model.HotspotProfile, error) {
	return model.HotspotProfile{Name: f.name}, nil
}

type fakeSettingStore struct{ isolirProfile string }

func (f *fakeSettingStore) Get(_ context.Context, key string) (string, error) {
	if key == "billing.isolir_profile_name" {
		return f.isolirProfile, nil
	}
	return "", nil
}

type fakeSubStore struct {
	lastStatus string
	updateErr  error
}

func (f *fakeSubStore) UpdateStatus(_ context.Context, _ uint, status string, _, _ *time.Time) error {
	f.lastStatus = status
	return f.updateErr
}

// ── ResolveProfile tests ─────────────────────────────────────────────────────

func TestResolveProfile_PPPoE_Active(t *testing.T) {
	pppID := uint(1)
	sub := model.Subscription{ServiceType: "pppoe", PPPProfileID: &pppID}

	svc := subsvc.New(subsvc.Deps{PPP: &fakePPPStore{name: "premium"}})
	name, disabled := svc.ResolveProfile(context.Background(), sub, "active")
	assert.Equal(t, "premium", name)
	assert.False(t, disabled)
}

func TestResolveProfile_PPPoE_Isolir(t *testing.T) {
	pppID := uint(1)
	sub := model.Subscription{ServiceType: "pppoe", PPPProfileID: &pppID}

	svc := subsvc.New(subsvc.Deps{
		PPP:      &fakePPPStore{name: "premium"},
		Settings: &fakeSettingStore{isolirProfile: "slow"},
	})
	name, disabled := svc.ResolveProfile(context.Background(), sub, "isolir")
	assert.Equal(t, "slow", name)
	assert.False(t, disabled)
}

func TestResolveProfile_PPPoE_Suspended(t *testing.T) {
	pppID := uint(1)
	sub := model.Subscription{ServiceType: "pppoe", PPPProfileID: &pppID}

	svc := subsvc.New(subsvc.Deps{PPP: &fakePPPStore{name: "premium"}})
	name, disabled := svc.ResolveProfile(context.Background(), sub, "suspended")
	assert.Equal(t, "premium", name)
	assert.True(t, disabled)
}

func TestResolveProfile_Hotspot_Active(t *testing.T) {
	hsID := uint(2)
	sub := model.Subscription{ServiceType: "hotspot", HotspotProfileID: &hsID}

	svc := subsvc.New(subsvc.Deps{Hotspot: &fakeHotspotStore{name: "hotspot-basic"}})
	name, disabled := svc.ResolveProfile(context.Background(), sub, "active")
	assert.Equal(t, "hotspot-basic", name)
	assert.False(t, disabled)
}

func TestResolveProfile_IsolirDefault(t *testing.T) {
	sub := model.Subscription{ServiceType: "pppoe"}
	svc := subsvc.New(subsvc.Deps{}) // no settings → default "isolir"
	name, _ := svc.ResolveProfile(context.Background(), sub, "isolir")
	assert.Equal(t, "isolir", name)
}

// ── SetStatus tests ──────────────────────────────────────────────────────────

func TestSetStatus_Active(t *testing.T) {
	ms := &fakeSubStore{}
	fixedNow := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)

	svc := subsvc.New(subsvc.Deps{
		Subs:    ms,
		NowFunc: func() time.Time { return fixedNow },
	})

	sub := model.Subscription{ID: 42, Status: "pending_install"}
	require.NoError(t, svc.SetStatus(context.Background(), &sub, "active", nil))

	assert.Equal(t, "active", ms.lastStatus)
	assert.Equal(t, "active", sub.Status)
	require.NotNil(t, sub.ActivatedAt)
	assert.Equal(t, fixedNow, *sub.ActivatedAt)
}

func TestSetStatus_Terminated(t *testing.T) {
	ms := &fakeSubStore{}
	svc := subsvc.New(subsvc.Deps{Subs: ms})

	sub := model.Subscription{ID: 1, Status: "active"}
	require.NoError(t, svc.SetStatus(context.Background(), &sub, "terminated", nil))

	assert.Equal(t, "terminated", sub.Status)
	assert.NotNil(t, sub.TerminatedAt)
}

func TestSetStatus_PropagatesError(t *testing.T) {
	ms := &fakeSubStore{updateErr: assert.AnError}
	svc := subsvc.New(subsvc.Deps{Subs: ms})

	sub := model.Subscription{ID: 1, Status: "active"}
	err := svc.SetStatus(context.Background(), &sub, "isolir", nil)
	require.Error(t, err)
	assert.Equal(t, "active", sub.Status) // tidak berubah jika error
}

func TestSetStatus_ActiveSecondTime_KeepsActivatedAt(t *testing.T) {
	// Jika sub sudah punya ActivatedAt, tidak diubah saat active lagi.
	ms := &fakeSubStore{}
	svc := subsvc.New(subsvc.Deps{Subs: ms})

	prev := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	sub := model.Subscription{ID: 1, Status: "isolir", ActivatedAt: &prev}
	require.NoError(t, svc.SetStatus(context.Background(), &sub, "active", nil))
	assert.Equal(t, prev, *sub.ActivatedAt) // tidak berubah
}
