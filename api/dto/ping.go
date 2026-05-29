package dto

import (
	"github.com/quiqxiq/rosmon/domain"
)

// ── Ping ───────────────────────────────────────────────────────────────

type PingResult struct {
	Seq    int     `json:"seq"`
	Host   string  `json:"host"`
	Size   int     `json:"size"`
	TTL    int     `json:"ttl,omitempty"`
	TimeMs float64 `json:"time_ms"`
	Status string  `json:"status,omitempty"`
}

type PingSummary struct {
	Target            string       `json:"target"`
	Sent              int          `json:"sent"`
	Received          int          `json:"received"`
	PacketLossPercent float64      `json:"packet_loss_percent"`
	MinRttMs          float64      `json:"min_rtt_ms"`
	AvgRttMs          float64      `json:"avg_rtt_ms"`
	MaxRttMs          float64      `json:"max_rtt_ms"`
	Results           []PingResult `json:"results"`
}

func FromDomainPingResult(r domain.PingResult) PingResult {
	return PingResult{
		Seq:    r.Seq,
		Host:   r.Host,
		Size:   r.Size,
		TTL:    r.TTL,
		TimeMs: r.TimeMs,
		Status: r.Status,
	}
}

func FromDomainPingResults(rr []domain.PingResult) []PingResult {
	out := make([]PingResult, len(rr))
	for i, r := range rr {
		out[i] = FromDomainPingResult(r)
	}
	return out
}

func FromDomainPingSummary(s domain.PingSummary) PingSummary {
	return PingSummary{
		Target:            s.Target,
		Sent:              s.Sent,
		Received:          s.Received,
		PacketLossPercent: s.PacketLossPercent,
		MinRttMs:          s.MinRttMs,
		AvgRttMs:          s.AvgRttMs,
		MaxRttMs:          s.MaxRttMs,
		Results:           FromDomainPingResults(s.Results),
	}
}
