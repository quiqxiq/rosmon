package dto

// LiveSession berisi data sesi aktif dari router untuk satu subscription.
// Nil berarti user sedang offline (tidak ada sesi aktif di router).
// CallerID diisi untuk PPPoE (MAC/nomor telepon perangkat).
// BytesIn/BytesOut diisi untuk hotspot permanent.
type LiveSession struct {
	Uptime   string `json:"uptime,omitempty"`
	Address  string `json:"address,omitempty"`
	CallerID string `json:"caller_id,omitempty"` // PPPoE only
	BytesIn  int64  `json:"bytes_in,omitempty"`  // hotspot permanent only
	BytesOut int64  `json:"bytes_out,omitempty"` // hotspot permanent only
}

// SubscriptionEnrichedResponse memperkaya SubscriptionResponse dengan
// data sesi real-time dari router dan deteksi drift kritis.
//
// RouterDrift nilai yang mungkin:
//   - "" (kosong)              = tidak ada drift
//   - "online_while_suspended" = user masih aktif di router padahal DB = suspended
//   - "online_while_terminated"= user masih aktif di router padahal DB = terminated
//
// Drift level lain (profile mismatch, secret hilang) tetap di-handle
// ReconcilerJob setiap jam — tidak diulang di endpoint ini agar respons tetap cepat.
type SubscriptionEnrichedResponse struct {
	Subscription SubscriptionResponse `json:"subscription"`
	Session      *LiveSession         `json:"session"`      // nil = offline
	RouterDrift  string               `json:"router_drift"` // "" = ok
}
