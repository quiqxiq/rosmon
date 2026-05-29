package ppp

import (
	"github.com/quiqxiq/roslib"
	"github.com/quiqxiq/rosmon/domain"
)

// SecretEvent → /ppp/secret/print follow event (analisis §1.12).
type SecretEvent struct {
	Secret domain.PPPSecret
	Dead   bool
}

// SecretStream → /ppp/secret/print follow (analisis §1.12).
func (c *Client) SecretStream(id string, h func(SecretEvent)) error {
	return c.dev.Path(secretPath).Print().Follow().Stream(id, func(s *roslib.Sentence) {
		h(SecretEvent{Secret: sentenceToSecret(s), Dead: s.Get(".dead") == "true"})
	})
}

// SecretStreamFollowOnly → /ppp/secret/print follow-only (analisis §1.12).
func (c *Client) SecretStreamFollowOnly(id string, h func(SecretEvent)) error {
	return c.dev.Path(secretPath).Print().FollowOnly().Stream(id, func(s *roslib.Sentence) {
		h(SecretEvent{Secret: sentenceToSecret(s), Dead: s.Get(".dead") == "true"})
	})
}

// StopSecretStream menghentikan listener /ppp/secret dengan ID tersebut (analisis §1.12).
func (c *Client) StopSecretStream(id string) bool {
	return c.dev.UnregisterStream(id)
}
