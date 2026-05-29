package dto

import (
	"github.com/quiqxiq/rosmon/domain"
	"github.com/quiqxiq/rosmon/mikrotik/ppp"
)

// ── PPP Secret ─────────────────────────────────────────────────────────

type PPPSecretResponse struct {
	ID                   string `json:"id"`
	Name                 string `json:"name"`
	Service              string `json:"service,omitempty"`
	Profile              string `json:"profile,omitempty"`
	LocalAddr            string `json:"local_address,omitempty"`
	RemoteAddr           string `json:"remote_address,omitempty"`
	LimitBytesIn         int64  `json:"limit_bytes_in"`
	LimitBytesOut        int64  `json:"limit_bytes_out"`
	LastLoggedOut        string `json:"last_logged_out,omitempty"`
	LastCallerID         string `json:"last_caller_id,omitempty"`
	LastDisconnectReason string `json:"last_disconnect_reason,omitempty"`
	Disabled             bool   `json:"disabled"`
	Comment              string `json:"comment,omitempty"`
	// Password sengaja tidak di-expose.
}

func FromDomainPPPSecret(s domain.PPPSecret) PPPSecretResponse {
	return PPPSecretResponse{
		ID: s.ID, Name: s.Name, Service: s.Service, Profile: s.Profile,
		LocalAddr: s.LocalAddr, RemoteAddr: s.RemoteAddr,
		LimitBytesIn: s.LimitBytesIn, LimitBytesOut: s.LimitBytesOut,
		LastLoggedOut: s.LastLoggedOut, LastCallerID: s.LastCallerID,
		LastDisconnectReason: s.LastDisconnectReason,
		Disabled:             s.Disabled, Comment: s.Comment,
	}
}

func FromDomainPPPSecrets(ss []domain.PPPSecret) []PPPSecretResponse {
	out := make([]PPPSecretResponse, len(ss))
	for i, s := range ss {
		out[i] = FromDomainPPPSecret(s)
	}
	return out
}

// PPPSecretCreateRequest — field UI form sesuai spec user (literal):
// name, password, service, profile, local-address, remote-address, limit-bytes-in/out.
// Disabled toggle pakai PATCH /secrets/{id}/disabled. Comment di-set lewat UpdateRequest.
type PPPSecretCreateRequest struct {
	Name          string `json:"name" binding:"required,min=1,max=128"`
	Password      string `json:"password,omitempty"`
	Service       string `json:"service,omitempty"`
	Profile       string `json:"profile,omitempty"`
	LocalAddr     string `json:"local_address,omitempty"`
	RemoteAddr    string `json:"remote_address,omitempty"`
	LimitBytesIn  int64  `json:"limit_bytes_in,omitempty"`
	LimitBytesOut int64  `json:"limit_bytes_out,omitempty"`
}

func (r PPPSecretCreateRequest) ToArgs() ppp.SecretAddArgs {
	return ppp.SecretAddArgs{
		Name: r.Name, Password: r.Password, Service: r.Service, Profile: r.Profile,
		LocalAddr: r.LocalAddr, RemoteAddr: r.RemoteAddr,
		LimitBytesIn: r.LimitBytesIn, LimitBytesOut: r.LimitBytesOut,
	}
}

// PPPSecretUpdateRequest — sparse update. nil = no change.
type PPPSecretUpdateRequest struct {
	Name          string `json:"name,omitempty"`
	Password      string `json:"password,omitempty"`
	Service       string `json:"service,omitempty"`
	Profile       string `json:"profile,omitempty"`
	LocalAddr     string `json:"local_address,omitempty"`
	RemoteAddr    string `json:"remote_address,omitempty"`
	LimitBytesIn  *int64 `json:"limit_bytes_in,omitempty"`
	LimitBytesOut *int64 `json:"limit_bytes_out,omitempty"`
}

func (r PPPSecretUpdateRequest) ToArgs(id string) ppp.SecretSetArgs {
	return ppp.SecretSetArgs{
		ID: id, Name: r.Name, Password: r.Password, Service: r.Service, Profile: r.Profile,
		LocalAddr: r.LocalAddr, RemoteAddr: r.RemoteAddr,
		LimitBytesIn: r.LimitBytesIn, LimitBytesOut: r.LimitBytesOut,
	}
}

// ── PPP Profile ────────────────────────────────────────────────────────

type RouterPPPProfileResponse struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	LocalAddr      string `json:"local_address,omitempty"`
	RemoteAddr     string `json:"remote_address,omitempty"`
	RateLimit      string `json:"rate_limit,omitempty"`
	SessionTimeout string `json:"session_timeout,omitempty"`
	IdleTimeout    string `json:"idle_timeout,omitempty"`
	ParentQueue    string `json:"parent_queue,omitempty"`
	OnUp           string `json:"on_up,omitempty"`
	OnDown         string `json:"on_down,omitempty"`
	Disabled       bool   `json:"disabled"`
	Comment        string `json:"comment,omitempty"`
}

func FromDomainPPPProfile(p domain.PPPProfile) RouterPPPProfileResponse {
	return RouterPPPProfileResponse{
		ID: p.ID, Name: p.Name, LocalAddr: p.LocalAddr, RemoteAddr: p.RemoteAddr,
		RateLimit: p.RateLimit, SessionTimeout: p.SessionTimeout, IdleTimeout: p.IdleTimeout,
		ParentQueue: p.ParentQueue, OnUp: p.OnUp, OnDown: p.OnDown,
		Disabled: p.Disabled, Comment: p.Comment,
	}
}

func FromDomainPPPProfiles(ps []domain.PPPProfile) []RouterPPPProfileResponse {
	out := make([]RouterPPPProfileResponse, len(ps))
	for i, p := range ps {
		out[i] = FromDomainPPPProfile(p)
	}
	return out
}

type RouterPPPProfileCreateRequest struct {
	Name           string `json:"name" binding:"required,min=1,max=128"`
	LocalAddr      string `json:"local_address,omitempty"`
	RemoteAddr     string `json:"remote_address,omitempty"`
	RateLimit      string `json:"rate_limit,omitempty"`
	SessionTimeout string `json:"session_timeout,omitempty"`
	IdleTimeout    string `json:"idle_timeout,omitempty"`
	ParentQueue    string `json:"parent_queue,omitempty"`
	OnUp           string `json:"on_up,omitempty"`
	OnDown         string `json:"on_down,omitempty"`
	Disabled       *bool  `json:"disabled,omitempty"`
	Comment        string `json:"comment,omitempty"`
}

func (r RouterPPPProfileCreateRequest) ToArgs() ppp.ProfileAddArgs {
	return ppp.ProfileAddArgs{
		Name: r.Name, LocalAddr: r.LocalAddr, RemoteAddr: r.RemoteAddr,
		RateLimit: r.RateLimit, SessionTimeout: r.SessionTimeout, IdleTimeout: r.IdleTimeout,
		ParentQueue: r.ParentQueue, OnUp: r.OnUp, OnDown: r.OnDown,
		Disabled: r.Disabled, Comment: r.Comment,
	}
}

type RouterPPPProfileUpdateRequest struct {
	Name           string  `json:"name,omitempty"`
	LocalAddr      string  `json:"local_address,omitempty"`
	RemoteAddr     string  `json:"remote_address,omitempty"`
	RateLimit      string  `json:"rate_limit,omitempty"`
	SessionTimeout *string `json:"session_timeout,omitempty"`
	IdleTimeout    *string `json:"idle_timeout,omitempty"`
	ParentQueue    *string `json:"parent_queue,omitempty"`
	OnUp           *string `json:"on_up,omitempty"`
	OnDown         *string `json:"on_down,omitempty"`
	Disabled       *bool   `json:"disabled,omitempty"`
	Comment        *string `json:"comment,omitempty"`
}

func (r RouterPPPProfileUpdateRequest) ToArgs(id string) ppp.ProfileSetArgs {
	return ppp.ProfileSetArgs{
		ID: id, Name: r.Name, LocalAddr: r.LocalAddr, RemoteAddr: r.RemoteAddr,
		RateLimit: r.RateLimit, SessionTimeout: r.SessionTimeout, IdleTimeout: r.IdleTimeout,
		ParentQueue: r.ParentQueue, OnUp: r.OnUp, OnDown: r.OnDown,
		Disabled: r.Disabled, Comment: r.Comment,
	}
}

// ── PPP Active ─────────────────────────────────────────────────────────

type PPPActiveResponse struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Service       string `json:"service,omitempty"`
	CallerID      string `json:"caller_id,omitempty"`
	Address       string `json:"address,omitempty"`
	Uptime        string `json:"uptime,omitempty"`
	LimitBytesIn  int64  `json:"limit_bytes_in"`
	LimitBytesOut int64  `json:"limit_bytes_out"`
	Comment       string `json:"comment,omitempty"`
}

func FromDomainPPPActive(a domain.PPPActive) PPPActiveResponse {
	return PPPActiveResponse{
		ID: a.ID, Name: a.Name, Service: a.Service,
		CallerID: a.CallerID, Address: a.Address, Uptime: a.Uptime,
		LimitBytesIn: a.LimitBytesIn, LimitBytesOut: a.LimitBytesOut,
		Comment: a.Comment,
	}
}

func FromDomainPPPActives(as []domain.PPPActive) []PPPActiveResponse {
	out := make([]PPPActiveResponse, len(as))
	for i, a := range as {
		out[i] = FromDomainPPPActive(a)
	}
	return out
}
