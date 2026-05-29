package dto

import (
	"github.com/quiqxiq/rosmon/domain"
	"github.com/quiqxiq/rosmon/mikrotik/network"
)

// ── Interface ──────────────────────────────────────────────────────────

type InterfaceResponse struct {
	ID               string `json:"id"`
	Name             string `json:"name"`
	DefaultName      string `json:"default_name,omitempty"`
	Type             string `json:"type,omitempty"`
	MTU              string `json:"mtu,omitempty"`
	ActualMTU        int64  `json:"actual_mtu,omitempty"`
	MACAddress       string `json:"mac_address,omitempty"`
	LastLinkUpTime   string `json:"last_link_up_time,omitempty"`
	LastLinkDownTime string `json:"last_link_down_time,omitempty"`
	LinkDowns        int64  `json:"link_downs,omitempty"`
	Running          bool   `json:"running"`
	Disabled         bool   `json:"disabled"`
	Comment          string `json:"comment,omitempty"`
}

func FromDomainInterface(i domain.Interface) InterfaceResponse {
	return InterfaceResponse{
		ID: i.ID, Name: i.Name, DefaultName: i.DefaultName, Type: i.Type,
		MTU: i.MTU, ActualMTU: i.ActualMTU, MACAddress: i.MACAddress,
		LastLinkUpTime: i.LastLinkUpTime, LastLinkDownTime: i.LastLinkDownTime,
		LinkDowns: i.LinkDowns,
		Running:   i.Running, Disabled: i.Disabled, Comment: i.Comment,
	}
}

func FromDomainInterfaces(is []domain.Interface) []InterfaceResponse {
	out := make([]InterfaceResponse, len(is))
	for i, x := range is {
		out[i] = FromDomainInterface(x)
	}
	return out
}

// ── Queue Simple ───────────────────────────────────────────────────────

type QueueSimpleResponse struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Target      string `json:"target,omitempty"`
	MaxLimit    string `json:"max_limit,omitempty"`
	LimitAt     string `json:"limit_at,omitempty"`
	BurstLimit  string `json:"burst_limit,omitempty"`
	Parent      string `json:"parent,omitempty"`
	Priority    string `json:"priority,omitempty"`
	BucketSize  string `json:"bucket_size,omitempty"`
	PacketMarks string `json:"packet_marks,omitempty"`
	Queue       string `json:"queue,omitempty"`
	Disabled    bool   `json:"disabled"`
	Dynamic     bool   `json:"dynamic"`
	Comment     string `json:"comment,omitempty"`
	Bytes       string `json:"bytes,omitempty"`
	Packets     string `json:"packets,omitempty"`
	Rate        string `json:"rate,omitempty"`
}

func FromDomainQueue(q domain.QueueSimple) QueueSimpleResponse {
	return QueueSimpleResponse{
		ID: q.ID, Name: q.Name, Target: q.Target,
		MaxLimit: q.MaxLimit, LimitAt: q.LimitAt, BurstLimit: q.BurstLimit, Parent: q.Parent,
		Priority: q.Priority, BucketSize: q.BucketSize, PacketMarks: q.PacketMarks, Queue: q.Queue,
		Disabled: q.Disabled, Dynamic: q.Dynamic, Comment: q.Comment,
		Bytes: q.Bytes, Packets: q.Packets, Rate: q.Rate,
	}
}

func FromDomainQueues(qs []domain.QueueSimple) []QueueSimpleResponse {
	out := make([]QueueSimpleResponse, len(qs))
	for i, q := range qs {
		out[i] = FromDomainQueue(q)
	}
	return out
}

// ── IP Pool ────────────────────────────────────────────────────────────

type IPPoolResponse struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Ranges    string `json:"ranges,omitempty"`
	Total     int64  `json:"total"`
	Used      int64  `json:"used"`
	Available int64  `json:"available"`
	NextPool  string `json:"next_pool,omitempty"`
	Comment   string `json:"comment,omitempty"`
}

func FromDomainPool(p domain.IPPool) IPPoolResponse {
	return IPPoolResponse{
		ID: p.ID, Name: p.Name, Ranges: p.Ranges,
		Total: p.Total, Used: p.Used, Available: p.Available,
		NextPool: p.NextPool, Comment: p.Comment,
	}
}

func FromDomainPools(ps []domain.IPPool) []IPPoolResponse {
	out := make([]IPPoolResponse, len(ps))
	for i, p := range ps {
		out[i] = FromDomainPool(p)
	}
	return out
}

// IPPoolCreateRequest membungkus body POST /network/pools.
type IPPoolCreateRequest struct {
	Name     string `json:"name"             binding:"required,min=1,max=128"`
	Ranges   string `json:"ranges"           binding:"required,min=1"`
	NextPool string `json:"next_pool,omitempty"`
	Comment  string `json:"comment,omitempty"`
}

func (r IPPoolCreateRequest) ToArgs() network.IPPoolAddArgs {
	return network.IPPoolAddArgs{
		Name: r.Name, Ranges: r.Ranges,
		NextPool: r.NextPool, Comment: r.Comment,
	}
}

// IPPoolUpdateRequest membungkus body PUT /network/pools/:id.
// Pointer = optional/PATCH-style; nil berarti tidak diubah.
type IPPoolUpdateRequest struct {
	Name     *string `json:"name,omitempty"`
	Ranges   *string `json:"ranges,omitempty"`
	NextPool *string `json:"next_pool,omitempty"`
	Comment  *string `json:"comment,omitempty"`
}

func (r IPPoolUpdateRequest) ToArgs(id string) network.IPPoolSetArgs {
	return network.IPPoolSetArgs{
		ID: id, Name: r.Name, Ranges: r.Ranges,
		NextPool: r.NextPool, Comment: r.Comment,
	}
}

// ── ARP ────────────────────────────────────────────────────────────────

type ARPEntryResponse struct {
	ID         string `json:"id"`
	Address    string `json:"address,omitempty"`
	MACAddress string `json:"mac_address,omitempty"`
	Interface  string `json:"interface,omitempty"`
	Dynamic    bool   `json:"dynamic"`
	Disabled   bool   `json:"disabled"`
	Complete   bool   `json:"complete"`
	Published  bool   `json:"published"`
	Invalid    bool   `json:"invalid"`
	Comment    string `json:"comment,omitempty"`
}

func FromDomainARP(a domain.ARPEntry) ARPEntryResponse {
	return ARPEntryResponse{
		ID: a.ID, Address: a.Address, MACAddress: a.MACAddress,
		Interface: a.Interface, Dynamic: a.Dynamic, Disabled: a.Disabled,
		Complete: a.Complete, Published: a.Published, Invalid: a.Invalid,
		Comment: a.Comment,
	}
}

func FromDomainARPs(as []domain.ARPEntry) []ARPEntryResponse {
	out := make([]ARPEntryResponse, len(as))
	for i, a := range as {
		out[i] = FromDomainARP(a)
	}
	return out
}

// ── DHCP Lease ─────────────────────────────────────────────────────────

type DHCPLeaseResponse struct {
	ID           string `json:"id"`
	Address      string `json:"address,omitempty"`
	MACAddress   string `json:"mac_address,omitempty"`
	ClientID     string `json:"client_id,omitempty"`
	HostName     string `json:"host_name,omitempty"`
	Server       string `json:"server,omitempty"`
	Status       string `json:"status,omitempty"`
	ExpiresAfter string `json:"expires_after,omitempty"`
	LastSeen     string `json:"last_seen,omitempty"`
	Dynamic      bool   `json:"dynamic"`
	Disabled     bool   `json:"disabled"`
	Comment      string `json:"comment,omitempty"`
}

func FromDomainLease(l domain.DHCPLease) DHCPLeaseResponse {
	return DHCPLeaseResponse{
		ID: l.ID, Address: l.Address, MACAddress: l.MACAddress, ClientID: l.ClientID,
		HostName: l.HostName, Server: l.Server, Status: l.Status,
		ExpiresAfter: l.ExpiresAfter, LastSeen: l.LastSeen,
		Dynamic: l.Dynamic, Disabled: l.Disabled, Comment: l.Comment,
	}
}

func FromDomainLeases(ls []domain.DHCPLease) []DHCPLeaseResponse {
	out := make([]DHCPLeaseResponse, len(ls))
	for i, l := range ls {
		out[i] = FromDomainLease(l)
	}
	return out
}

// ── TrafficSnapshot (untuk SSE stream payload) ─────────────────────────

type TrafficResponse struct {
	Name            string `json:"name,omitempty"`
	RxBitsPerSec    int64  `json:"rx_bits_per_sec"`
	TxBitsPerSec    int64  `json:"tx_bits_per_sec"`
	RxPacketsPerSec int64  `json:"rx_packets_per_sec"`
	TxPacketsPerSec int64  `json:"tx_packets_per_sec"`
}
