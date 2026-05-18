package expiry

import (
	"strings"
	"time"
)

// mikhmon date format: "jan/05/2025 15:04:05" (lowercase 3-letter month).
//
// PENTING: Go's time.Parse layout token "Jan" (capitalized) di-match
// case-insensitive, sedangkan "jan" lowercase di-treat sebagai literal
// string — yang akan membuat hanya bulan Januari saja yang parseable.
// Pakai "Jan" supaya feb/mar/...dec semua parsable.
const mikhmonLayout = "Jan/02/2006 15:04:05"

// ParseExpiry memparse field comment format mikhmon menjadi time.Time.
// Mengembalikan (time, true) jika valid, (zero, false) jika bukan expiry comment.
//
// Layout "Jan/02/2006 15:04:05" panjangnya 20 karakter; pakai
// len(mikhmonLayout) bukan literal 19 supaya konsisten dan tidak
// off-by-one (bug pre-existing yang strip karakter terakhir).
func ParseExpiry(comment string) (time.Time, bool) {
	comment = strings.TrimSpace(comment)
	if len(comment) < len(mikhmonLayout) {
		return time.Time{}, false
	}
	t, err := time.Parse(mikhmonLayout, comment[:len(mikhmonLayout)])
	if err != nil {
		return time.Time{}, false
	}
	return t, true
}
