package handler

// mikrotikSystemProfiles adalah nama profile bawaan RouterOS yang tidak boleh
// di-import ke DB — mereka bukan profile billing dan tidak boleh muncul di UI.
var mikrotikSystemProfiles = map[string]struct{}{
	"default":            {},
	"default-encryption": {},
}

// isSystemProfile returns true jika name adalah profile sistem RouterOS
// yang harus di-skip saat sync.
func isSystemProfile(name string) bool {
	_, ok := mikrotikSystemProfiles[name]
	return ok
}
