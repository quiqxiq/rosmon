package ppp

import (
	"context"

	"github.com/quiqxiq/roslib"
	"github.com/quiqxiq/rosmon/domain"
	"github.com/quiqxiq/rosmon/mikrotik"
)

const profilePath = "/ppp/profile"

// ProfileList → /ppp/profile/print (analisis §1.12 — inferred).
func (c *Client) ProfileList(ctx context.Context) ([]domain.PPPProfile, error) {
	reply, err := c.dev.Path(profilePath).Print().Exec(ctx)
	if err != nil {
		return nil, err
	}
	return sentencesToProfiles(reply.Rows), nil
}

// ProfileByName → /ppp/profile/print ?name=<name>.
func (c *Client) ProfileByName(ctx context.Context, name string) (domain.PPPProfile, error) {
	if name == "" {
		return domain.PPPProfile{}, mikrotik.ErrInvalidArgument
	}
	reply, err := c.dev.Path(profilePath).Print().Where("name", name).Exec(ctx)
	if err != nil {
		return domain.PPPProfile{}, err
	}
	if len(reply.Rows) == 0 {
		return domain.PPPProfile{}, mikrotik.ErrNotFound
	}
	return sentenceToProfile(reply.Rows[0]), nil
}

// ProfileAddArgs adalah parameter ProfileAdd.
type ProfileAddArgs struct {
	Name           string // wajib
	LocalAddr      string
	RemoteAddr     string
	RateLimit      string // format "rx/tx" mis. "10M/10M"
	SessionTimeout string // RouterOS duration (mis. "1h30m")
	IdleTimeout    string
	ParentQueue    string
	OnUp           string // script on-up; optional
	OnDown         string // script on-down; optional
	Comment        string
}

// ProfileAdd → /ppp/profile/add (analisis §1.12).
func (c *Client) ProfileAdd(ctx context.Context, a ProfileAddArgs) (string, error) {
	if a.Name == "" {
		return "", mikrotik.ErrInvalidArgument
	}
	pairs := []roslib.Pair{roslib.NewPair("name", a.Name)}
	if a.LocalAddr != "" {
		pairs = append(pairs, roslib.NewPair("local-address", a.LocalAddr))
	}
	if a.RemoteAddr != "" {
		pairs = append(pairs, roslib.NewPair("remote-address", a.RemoteAddr))
	}
	if a.RateLimit != "" {
		pairs = append(pairs, roslib.NewPair("rate-limit", a.RateLimit))
	}
	if a.SessionTimeout != "" {
		pairs = append(pairs, roslib.NewPair("session-timeout", a.SessionTimeout))
	}
	if a.IdleTimeout != "" {
		pairs = append(pairs, roslib.NewPair("idle-timeout", a.IdleTimeout))
	}
	if a.ParentQueue != "" && a.ParentQueue != "none" {
		pairs = append(pairs, roslib.NewPair("parent-queue", a.ParentQueue))
	}
	if a.OnUp != "" {
		pairs = append(pairs, roslib.NewPair("on-up", a.OnUp))
	}
	if a.OnDown != "" {
		pairs = append(pairs, roslib.NewPair("on-down", a.OnDown))
	}
	if a.Comment != "" {
		pairs = append(pairs, roslib.NewPair("comment", a.Comment))
	}
	reply, err := c.dev.Path(profilePath).Add(ctx, pairs...)
	if err != nil {
		return "", err
	}
	if reply.Done == nil {
		return "", nil
	}
	return reply.Done.Map["ret"], nil
}

// ProfileSetArgs adalah parameter ProfileSet.
type ProfileSetArgs struct {
	ID             string // wajib
	Name           string
	LocalAddr      string
	RemoteAddr     string
	RateLimit      string
	SessionTimeout *string
	IdleTimeout    *string
	ParentQueue    *string
	OnUp           *string
	OnDown         *string
	Comment        *string
}

// ProfileSet → /ppp/profile/set (analisis §1.12).
func (c *Client) ProfileSet(ctx context.Context, a ProfileSetArgs) error {
	if a.ID == "" {
		return mikrotik.ErrInvalidArgument
	}
	pairs := []roslib.Pair{}
	if a.Name != "" {
		pairs = append(pairs, roslib.NewPair("name", a.Name))
	}
	if a.LocalAddr != "" {
		pairs = append(pairs, roslib.NewPair("local-address", a.LocalAddr))
	}
	if a.RemoteAddr != "" {
		pairs = append(pairs, roslib.NewPair("remote-address", a.RemoteAddr))
	}
	if a.RateLimit != "" {
		pairs = append(pairs, roslib.NewPair("rate-limit", a.RateLimit))
	}
	if a.SessionTimeout != nil {
		pairs = append(pairs, roslib.NewPair("session-timeout", *a.SessionTimeout))
	}
	if a.IdleTimeout != nil {
		pairs = append(pairs, roslib.NewPair("idle-timeout", *a.IdleTimeout))
	}
	if a.ParentQueue != nil && *a.ParentQueue != "" && *a.ParentQueue != "none" {
		pairs = append(pairs, roslib.NewPair("parent-queue", *a.ParentQueue))
	}
	if a.OnUp != nil {
		pairs = append(pairs, roslib.NewPair("on-up", *a.OnUp))
	}
	if a.OnDown != nil {
		pairs = append(pairs, roslib.NewPair("on-down", *a.OnDown))
	}
	if a.Comment != nil {
		pairs = append(pairs, roslib.NewPair("comment", *a.Comment))
	}
	_, err := c.dev.Path(profilePath).Set(ctx, a.ID, pairs...)
	return err
}

// ProfileRemove → /ppp/profile/remove (analisis §1.12).
func (c *Client) ProfileRemove(ctx context.Context, id string) error {
	if id == "" {
		return mikrotik.ErrInvalidArgument
	}
	_, err := c.dev.Path(profilePath).Remove(ctx, id)
	return err
}

func sentenceToProfile(s *roslib.Sentence) domain.PPPProfile {
	return domain.PPPProfile{
		ID:             s.Get(".id"),
		Name:           s.Get("name"),
		LocalAddr:      s.Get("local-address"),
		RemoteAddr:     s.Get("remote-address"),
		RateLimit:      s.Get("rate-limit"),
		DNSServer:      s.Get("dns-server"),
		Bridge:         s.Get("bridge"),
		ParentQueue:    s.Get("parent-queue"),
		IdleTimeout:    s.Get("idle-timeout"),
		SessionTimeout: s.Get("session-timeout"),
		OnUp:           s.Get("on-up"),
		OnDown:         s.Get("on-down"),
		OnlyOne:        s.Get("only-one"),
		UseCompression: s.Get("use-compression"),
		UseEncryption:  s.Get("use-encryption"),
		ChangeTCPMSS:   s.Get("change-tcp-mss"),
		Disabled:       s.BoolOr("disabled", false),
		Comment:        s.Get("comment"),
	}
}

func sentencesToProfiles(rows []*roslib.Sentence) []domain.PPPProfile {
	out := make([]domain.PPPProfile, 0, len(rows))
	for _, r := range rows {
		out = append(out, sentenceToProfile(r))
	}
	return out
}
