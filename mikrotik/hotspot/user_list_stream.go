package hotspot

import (
	"github.com/quiqxiq/roslib"
	"github.com/quiqxiq/rosmon/domain"
)

// UserEvent → /ip/hotspot/user/print follow event (analisis §1.6).
type UserEvent struct {
	User domain.HotspotUser
	Dead bool
}

// UserListStream → /ip/hotspot/user/print follow (analisis §1.6).
func (c *Client) UserListStream(id string, h func(UserEvent)) error {
	return c.dev.Path(userPath).Print().Follow().Stream(id, func(s *roslib.Sentence) {
		h(UserEvent{User: sentenceToUser(s), Dead: s.Get(".dead") == "true"})
	})
}

// UserListStreamFollowOnly → /ip/hotspot/user/print follow-only (analisis §1.6).
func (c *Client) UserListStreamFollowOnly(id string, h func(UserEvent)) error {
	return c.dev.Path(userPath).Print().FollowOnly().Stream(id, func(s *roslib.Sentence) {
		h(UserEvent{User: sentenceToUser(s), Dead: s.Get(".dead") == "true"})
	})
}

// StopUserListStream menghentikan listener /ip/hotspot/user dengan ID tersebut (analisis §1.6).
func (c *Client) StopUserListStream(id string) bool {
	return c.dev.UnregisterStream(id)
}
