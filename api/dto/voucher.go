package dto

import "github.com/quiqxiq/rosmon/domain"

// VoucherGenerateRequest body untuk POST /hotspot/vouchers/generate.
// Mengikuti analisis §7 mikhmonv3 (Quick Print fields) ditambah field
// untuk record transaction (price, validity).
type VoucherGenerateRequest struct {
	Server    string `json:"server,omitempty"`                                              // "all" atau nama server hotspot; default ke "all" kalau kosong
	UserMode  string `json:"user_mode,omitempty"  binding:"omitempty,oneof=up vc"`          // "up" (user+pass berbeda) atau "vc" (voucher code, user=pass)
	Length    int    `json:"length"                binding:"required,min=4,max=32"`         // panjang username & password
	Prefix    string `json:"prefix,omitempty"      binding:"max=16"`                        // prefix username (tidak masuk hitungan Length)
	Charset   string `json:"charset"               binding:"required"`                      // lihat domain.Charset (lower, upper, mixed, number, lower_number, upper_number, mixed_number)
	Profile   string `json:"profile"               binding:"required,min=1,max=128"`        // nama profile hotspot
	TimeLimit string `json:"time_limit,omitempty"`                                          // limit-uptime (RouterOS format)
	DataLimit int64  `json:"data_limit,omitempty"  binding:"omitempty,min=0"`               // limit-bytes-total
	Comment   string `json:"comment,omitempty"     binding:"max=128"`
	Validity  string `json:"validity,omitempty"`                                            // Go duration (mis. "168h"); attach expiry stamp ke comment
	Price     int    `json:"price,omitempty"       binding:"omitempty,min=0"`               // harga normal
	SellPrice int    `json:"sell_price,omitempty"  binding:"omitempty,min=0"`               // harga jual
	LockToMAC bool   `json:"lock_to_mac,omitempty"`
	BatchSize int    `json:"batch_size"            binding:"required,min=1,max=1000"`
}

// ToDomain mengubah request DTO menjadi domain.VoucherSpec, dengan
// default value sensible (UserMode="up", Server="all" kalau kosong).
func (r VoucherGenerateRequest) ToDomain() domain.VoucherSpec {
	mode := r.UserMode
	if mode == "" {
		mode = "up"
	}
	server := r.Server
	if server == "" {
		server = "all"
	}
	return domain.VoucherSpec{
		Server:    server,
		UserMode:  mode,
		Length:    r.Length,
		Prefix:    r.Prefix,
		Charset:   domain.Charset(r.Charset),
		Profile:   r.Profile,
		TimeLimit: r.TimeLimit,
		DataLimit: r.DataLimit,
		Comment:   r.Comment,
		Validity:  r.Validity,
		Price:     r.Price,
		SellPrice: r.SellPrice,
		LockToMAC: r.LockToMAC,
		BatchSize: r.BatchSize,
	}
}

// VoucherResponse adalah satu voucher yang berhasil di-create.
type VoucherResponse struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Password string `json:"password"`
}

// VoucherGenerateResponse adalah body untuk POST /hotspot/vouchers/generate.
// Vouchers menampung yang BERHASIL dibuat. Kalau ada Partial=true, request
// gagal di tengah jalan (Error berisi pesan); vouchers yang sudah ada
// tetap valid di RouterOS dan caller dapat memutuskan rollback manual
// via bulk-delete.
type VoucherGenerateResponse struct {
	Vouchers []VoucherResponse `json:"vouchers"`
	Count    int               `json:"count"`
	Partial  bool              `json:"partial,omitempty"`
	Error    string            `json:"error,omitempty"`
}
