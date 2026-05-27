package workflows

import "strings"

const (
	TagBW = "rosmon:bw"
	TagVC = "rosmon:vc"
)

func hasTag(comment, tag string) bool {
	return comment == tag ||
		strings.HasPrefix(comment, tag+" ") ||
		strings.HasPrefix(comment, tag+"|")
}

func commentVC(profileName string, cfg OnLoginConfig) string {
	if cfg.ExpiryMode == "0" || cfg.ExpiryMode == "" {
		return TagVC
	}
	return TagVC + " | " + cfg.ExpiryMode + " " + cfg.Validity
}
