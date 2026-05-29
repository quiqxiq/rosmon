package dto

import "github.com/quiqxiq/rosmon/domain"

// InterfaceStatsEvent adalah typed event untuk SSE /stream/network/interfaces/stats.
type InterfaceStatsEvent struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Type     string `json:"type"`
	RxByte   int64  `json:"rx_byte"`
	TxByte   int64  `json:"tx_byte"`
	RxPacket int64  `json:"rx_packet"`
	TxPacket int64  `json:"tx_packet"`
	Running  bool   `json:"running"`
	Disabled bool   `json:"disabled"`
}

// QueueStatsEvent adalah typed event untuk SSE /stream/network/queues/stats.
// Format string "in/out" untuk counter pakai konvensi RouterOS bawaan.
type QueueStatsEvent struct {
	ID                 string `json:"id"`
	Name               string `json:"name"`
	Target             string `json:"target"`
	Parent             string `json:"parent,omitempty"`
	Disabled           bool   `json:"disabled"`
	Dynamic            bool   `json:"dynamic"`
	Comment            string `json:"comment,omitempty"`
	Bytes              string `json:"bytes"`
	Packets            string `json:"packets"`
	Rate               string `json:"rate"`
	TotalRate          string `json:"total_rate,omitempty"`
	PacketRate         string `json:"packet_rate,omitempty"`
	TotalPacketRate    string `json:"total_packet_rate,omitempty"`
	QueuedBytes        string `json:"queued_bytes,omitempty"`
	TotalQueuedBytes   string `json:"total_queued_bytes,omitempty"`
	QueuedPackets      string `json:"queued_packets,omitempty"`
	TotalQueuedPackets string `json:"total_queued_packets,omitempty"`
	TotalBytes         string `json:"total_bytes,omitempty"`
	TotalPackets       string `json:"total_packets,omitempty"`
	Dropped            string `json:"dropped,omitempty"`
	TotalDropped       string `json:"total_dropped,omitempty"`
	MaxLimit           string `json:"max_limit,omitempty"`
}

// FromDomainQueueStats memetakan domain.QueueSimpleWithStats ke event SSE.
func FromDomainQueueStats(q domain.QueueSimpleWithStats) QueueStatsEvent {
	return QueueStatsEvent{
		ID: q.ID, Name: q.Name, Target: q.Target, Parent: q.Parent,
		Disabled: q.Disabled, Dynamic: q.Dynamic, Comment: q.Comment,
		Bytes: q.Bytes, Packets: q.Packets, Rate: q.Rate,
		TotalRate: q.TotalRate, PacketRate: q.PacketRate, TotalPacketRate: q.TotalPacketRate,
		QueuedBytes: q.QueuedBytes, TotalQueuedBytes: q.TotalQueuedBytes,
		QueuedPackets: q.QueuedPackets, TotalQueuedPackets: q.TotalQueuedPackets,
		TotalBytes: q.TotalBytes, TotalPackets: q.TotalPackets,
		Dropped: q.Dropped, TotalDropped: q.TotalDropped,
		MaxLimit: q.MaxLimit,
	}
}

// HotspotActiveEvent adalah typed event untuk SSE /stream/hotspot/active.
// Field dead=true menandakan session yang terminate (event dari print follow).
type HotspotActiveEvent struct {
	ID         string `json:"id"`
	User       string `json:"user"`
	Address    string `json:"address,omitempty"`
	MACAddress string `json:"mac_address,omitempty"`
	Server     string `json:"server,omitempty"`
	LoginBy    string `json:"login_by,omitempty"`
	BytesIn    int64  `json:"bytes_in"`
	BytesOut   int64  `json:"bytes_out"`
	Uptime     string `json:"uptime,omitempty"`
	Dead       bool   `json:"dead"`
}

// PPPActiveEvent adalah typed event untuk SSE /stream/ppp/active.
// Field dead=true menandakan session yang terminate (event dari print follow).
type PPPActiveEvent struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Service  string `json:"service,omitempty"`
	CallerID string `json:"caller_id,omitempty"`
	Address  string `json:"address,omitempty"`
	Uptime   string `json:"uptime,omitempty"`
	Dead     bool   `json:"dead"`
}

// LogEvent adalah typed event untuk SSE /stream/log.
type LogEvent struct {
	ID      string `json:"id"`
	Time    string `json:"time"`
	Topics  string `json:"topics"`
	Message string `json:"message"`
}

// PPPSecretEvent adalah typed event untuk SSE /stream/ppp/secrets
// (mengikuti /ppp/secret/print follow). Field dead=true menandakan
// row yang dihapus dari tabel.
type PPPSecretEvent struct {
	ID                   string `json:"id"`
	Name                 string `json:"name"`
	Service              string `json:"service,omitempty"`
	Profile              string `json:"profile,omitempty"`
	LimitBytesIn         int64  `json:"limit_bytes_in"`
	LimitBytesOut        int64  `json:"limit_bytes_out"`
	LastLoggedOut        string `json:"last_logged_out,omitempty"`
	LastCallerID         string `json:"last_caller_id,omitempty"`
	LastDisconnectReason string `json:"last_disconnect_reason,omitempty"`
	Disabled             bool   `json:"disabled"`
	Comment              string `json:"comment,omitempty"`
	Dead                 bool   `json:"dead"`
}

// FromDomainPPPSecretEvent memetakan domain.PPPSecret + flag dead ke event.
func FromDomainPPPSecretEvent(s domain.PPPSecret, dead bool) PPPSecretEvent {
	return PPPSecretEvent{
		ID: s.ID, Name: s.Name, Service: s.Service, Profile: s.Profile,
		LimitBytesIn: s.LimitBytesIn, LimitBytesOut: s.LimitBytesOut,
		LastLoggedOut: s.LastLoggedOut, LastCallerID: s.LastCallerID,
		LastDisconnectReason: s.LastDisconnectReason,
		Disabled:             s.Disabled, Comment: s.Comment, Dead: dead,
	}
}

// HotspotUserEvent adalah typed event untuk SSE /stream/hotspot/users
// (mengikuti /ip/hotspot/user/print follow). Field dead=true menandakan
// row yang dihapus dari tabel.
type HotspotUserEvent struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Profile    string `json:"profile,omitempty"`
	MACAddress string `json:"mac_address,omitempty"`
	Address    string `json:"address,omitempty"`
	Email      string `json:"email,omitempty"`
	Server     string `json:"server,omitempty"`
	Disabled   bool   `json:"disabled"`
	Comment    string `json:"comment,omitempty"`
	Dead       bool   `json:"dead"`
}

// FromDomainHotspotUserEvent memetakan domain.HotspotUser + flag dead ke event.
func FromDomainHotspotUserEvent(u domain.HotspotUser, dead bool) HotspotUserEvent {
	return HotspotUserEvent{
		ID: u.ID, Name: u.Name, Profile: u.Profile, MACAddress: u.MACAddress,
		Address: u.Address, Email: u.Email, Server: u.Server,
		Disabled: u.Disabled, Comment: u.Comment, Dead: dead,
	}
}

// PPPInactiveEvent adalah typed event untuk SSE /stream/ppp/inactive
// (derived: enabled /ppp/secret minus /ppp/active). Action salah satu:
// "added" | "removed" | "changed".
//
// Field `address` = last-known IP, di-track dari /ppp/active oleh workflow
// state machine. Kosong kalau secret belum pernah aktif sejak server start.
type PPPInactiveEvent struct {
	Name                 string `json:"name"`
	Profile              string `json:"profile,omitempty"`
	CallerID             string `json:"caller_id,omitempty"`
	LastCallerID         string `json:"last_caller_id,omitempty"`
	LastLoggedOut        string `json:"last_logged_out,omitempty"`
	LastDisconnectReason string `json:"last_disconnect_reason,omitempty"`
	Address              string `json:"address,omitempty"`
	Action               string `json:"action"`
}

// HotspotInactiveEvent adalah typed event untuk SSE /stream/hotspot/inactive
// (derived: enabled /ip/hotspot/user minus /ip/hotspot/active). Action salah
// satu: "added" | "removed" | "changed".
type HotspotInactiveEvent struct {
	User   HotspotUserEvent `json:"user"`
	Action string           `json:"action"`
}

// RouterboardEvent adalah typed event untuk SSE /stream/system/routerboard.
type RouterboardEvent struct {
	Routerboard     bool   `json:"routerboard"`
	BoardName       string `json:"board_name,omitempty"`
	Model           string `json:"model,omitempty"`
	Revision        string `json:"revision,omitempty"`
	SerialNumber    string `json:"serial_number,omitempty"`
	FirmwareType    string `json:"firmware_type,omitempty"`
	CurrentFirmware string `json:"current_firmware,omitempty"`
	UpgradeFirmware string `json:"upgrade_firmware,omitempty"`
}
