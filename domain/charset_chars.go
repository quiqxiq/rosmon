package domain

// Chars mengembalikan rune set yang valid untuk charset.
// Dipakai oleh workflows/generate_vouchers untuk random pick.
//
// Konvensi karakter yang dihindari (untuk readability voucher fisik):
//   - O (uppercase O) vs 0 (digit nol)
//   - l (lowercase L) vs 1 (digit satu)
//   - I (uppercase i) vs 1
//
// Mengikuti konvensi quick-print mikhmonv3 yang menggunakan abc...xyz
// tanpa karakter mirip-angka.
func (c Charset) Chars() string {
	const (
		lower  = "abcdefghjkmnpqrstuvwxyz"  // exclude i, l, o
		upper  = "ABCDEFGHJKLMNPQRSTUVWXYZ" // exclude I, O
		number = "23456789"                 // exclude 0, 1
	)
	switch c {
	case CharsetLower:
		return lower
	case CharsetUpper:
		return upper
	case CharsetMixed:
		return lower + upper
	case CharsetNumber:
		return number
	case CharsetLowNum:
		return lower + number
	case CharsetUpNum:
		return upper + number
	case CharsetMixNum:
		return lower + upper + number
	}
	return ""
}
