package workflows

import (
	"sync"

	"github.com/quiqxiq/roslib"
	"github.com/quiqxiq/rosmon/domain"
	"github.com/quiqxiq/rosmon/mikrotik/hotspot"
	"github.com/quiqxiq/rosmon/mikrotik/ppp"
)

const (
	inactiveActionAdded   = "added"
	inactiveActionRemoved = "removed"
	inactiveActionChanged = "changed"
)

// PPPInactiveEvent → derived enabled /ppp/secret minus /ppp/active event (analisis §1.12, §4).
//
// Address = last-known IP yang di-track dari /ppp/active stream. Kosong kalau
// secret belum pernah aktif sejak workflow start.
type PPPInactiveEvent struct {
	Name                 string
	Profile              string
	CallerID             string
	LastCallerID         string
	LastLoggedOut        string
	LastDisconnectReason string
	Address              string
	Action               string
}

// PPPInactiveStream → derived enabled /ppp/secret minus /ppp/active stream (analisis §1.12, §4).
func (c *Clients) PPPInactiveStream(id string, h func(PPPInactiveEvent)) error {
	st := newPPPInactiveState(h)
	activeID := id + ":ppp-active"
	secretID := id + ":ppp-secret"
	if err := c.PPP.ActiveStream(activeID, st.onActive); err != nil {
		return err
	}
	if err := c.PPP.SecretStream(secretID, st.onSecret); err != nil {
		c.PPP.StopActiveStream(activeID)
		return err
	}
	return nil
}

// StopPPPInactiveStream menghentikan derived PPP inactive stream (analisis §1.12, §4).
func (c *Clients) StopPPPInactiveStream(id string) bool {
	stopped := c.PPP.StopActiveStream(id + ":ppp-active")
	return c.PPP.StopSecretStream(id+":ppp-secret") || stopped
}

// HotspotInactiveEvent → derived enabled /ip/hotspot/user minus /ip/hotspot/active event (analisis §1.6, §1.8, §4).
type HotspotInactiveEvent struct {
	User   domain.HotspotUser
	Action string
}

// HotspotInactiveStream → derived enabled /ip/hotspot/user minus /ip/hotspot/active stream (analisis §1.6, §1.8, §4).
func (c *Clients) HotspotInactiveStream(id string, h func(HotspotInactiveEvent)) error {
	st := newHotspotInactiveState(h)
	activeID := id + ":hotspot-active"
	userID := id + ":hotspot-user"
	if err := c.Hotspot.ActiveStream(activeID, st.onActive); err != nil {
		return err
	}
	if err := c.Hotspot.UserListStream(userID, st.onUser); err != nil {
		c.Hotspot.StopActiveStream(activeID)
		return err
	}
	return nil
}

// StopHotspotInactiveStream menghentikan derived hotspot inactive stream (analisis §1.6, §1.8, §4).
func (c *Clients) StopHotspotInactiveStream(id string) bool {
	stopped := c.Hotspot.StopActiveStream(id + ":hotspot-active")
	return c.Hotspot.StopUserListStream(id+":hotspot-user") || stopped
}

type pppInactiveState struct {
	mu            sync.Mutex
	emitMu        sync.Mutex
	configured    map[string]domain.PPPSecret
	configuredIDs map[string]string
	activeIDs     map[string]string
	activeCounts  map[string]int
	lastAddress   map[string]string // key: secret name → last-seen address di /ppp/active
	inactive      map[string]domain.PPPSecret
	h             func(PPPInactiveEvent)
}

func newPPPInactiveState(h func(PPPInactiveEvent)) *pppInactiveState {
	return &pppInactiveState{
		configured:    make(map[string]domain.PPPSecret),
		configuredIDs: make(map[string]string),
		activeIDs:     make(map[string]string),
		activeCounts:  make(map[string]int),
		lastAddress:   make(map[string]string),
		inactive:      make(map[string]domain.PPPSecret),
		h:             h,
	}
}

func (s *pppInactiveState) onSecret(e ppp.SecretEvent) {
	s.mu.Lock()
	if e.Dead {
		name := e.Secret.Name
		if name == "" {
			name = s.configuredIDs[e.Secret.ID]
		}
		if name != "" {
			delete(s.configured, name)
		}
		if e.Secret.ID != "" {
			delete(s.configuredIDs, e.Secret.ID)
		}
	} else if e.Secret.Name != "" {
		if e.Secret.ID != "" {
			old := s.configuredIDs[e.Secret.ID]
			if old != "" && old != e.Secret.Name {
				delete(s.configured, old)
			}
			s.configuredIDs[e.Secret.ID] = e.Secret.Name
		}
		if e.Secret.Disabled {
			delete(s.configured, e.Secret.Name)
		} else {
			s.configured[e.Secret.Name] = e.Secret
		}
	}
	events := s.reconcileLocked()
	s.mu.Unlock()
	s.emit(events)
}

func (s *pppInactiveState) onActive(row *roslib.Sentence) {
	s.mu.Lock()
	id := row.Get(".id")
	name := row.Get("name")
	if row.Get(".dead") == "true" {
		if name == "" {
			name = s.activeIDs[id]
		}
		s.removeActiveLocked(id, name)
	} else if name != "" {
		s.setActiveLocked(id, name)
		if addr := row.Get("address"); addr != "" {
			s.lastAddress[name] = addr
		}
	}
	events := s.reconcileLocked()
	s.mu.Unlock()
	s.emit(events)
}

func (s *pppInactiveState) setActiveLocked(id, name string) {
	if id == "" {
		if s.activeCounts[name] == 0 {
			s.activeCounts[name] = 1
		}
		return
	}
	old := s.activeIDs[id]
	if old == name {
		return
	}
	if old != "" {
		s.decrementActiveLocked(old)
	}
	s.activeIDs[id] = name
	s.activeCounts[name]++
}

func (s *pppInactiveState) removeActiveLocked(id, name string) {
	if id != "" {
		delete(s.activeIDs, id)
	}
	if name != "" {
		s.decrementActiveLocked(name)
	}
}

func (s *pppInactiveState) decrementActiveLocked(name string) {
	if s.activeCounts[name] <= 1 {
		delete(s.activeCounts, name)
		return
	}
	s.activeCounts[name]--
}

func (s *pppInactiveState) reconcileLocked() []PPPInactiveEvent {
	next := make(map[string]domain.PPPSecret)
	for name, secret := range s.configured {
		if s.activeCounts[name] == 0 {
			next[name] = secret
		}
	}
	events := make([]PPPInactiveEvent, 0)
	for name, prev := range s.inactive {
		cur, ok := next[name]
		if !ok {
			events = append(events, s.buildPPPInactiveEvent(prev, inactiveActionRemoved))
			continue
		}
		if cur != prev {
			events = append(events, s.buildPPPInactiveEvent(cur, inactiveActionChanged))
		}
	}
	for name, cur := range next {
		if _, ok := s.inactive[name]; !ok {
			events = append(events, s.buildPPPInactiveEvent(cur, inactiveActionAdded))
		}
	}
	s.inactive = next
	return events
}

func (s *pppInactiveState) buildPPPInactiveEvent(sec domain.PPPSecret, action string) PPPInactiveEvent {
	return PPPInactiveEvent{
		Name:                 sec.Name,
		Profile:              sec.Profile,
		CallerID:             sec.CallerID,
		LastCallerID:         sec.LastCallerID,
		LastLoggedOut:        sec.LastLoggedOut,
		LastDisconnectReason: sec.LastDisconnectReason,
		Address:              s.lastAddress[sec.Name],
		Action:               action,
	}
}

func (s *pppInactiveState) emit(events []PPPInactiveEvent) {
	if len(events) == 0 || s.h == nil {
		return
	}
	s.emitMu.Lock()
	defer s.emitMu.Unlock()
	for _, event := range events {
		s.h(event)
	}
}

type hotspotInactiveState struct {
	mu            sync.Mutex
	emitMu        sync.Mutex
	configured    map[string]domain.HotspotUser
	configuredIDs map[string]string
	activeIDs     map[string]string
	activeCounts  map[string]int
	inactive      map[string]domain.HotspotUser
	h             func(HotspotInactiveEvent)
}

func newHotspotInactiveState(h func(HotspotInactiveEvent)) *hotspotInactiveState {
	return &hotspotInactiveState{
		configured:    make(map[string]domain.HotspotUser),
		configuredIDs: make(map[string]string),
		activeIDs:     make(map[string]string),
		activeCounts:  make(map[string]int),
		inactive:      make(map[string]domain.HotspotUser),
		h:             h,
	}
}

func (s *hotspotInactiveState) onUser(e hotspot.UserEvent) {
	s.mu.Lock()
	if e.Dead {
		name := e.User.Name
		if name == "" {
			name = s.configuredIDs[e.User.ID]
		}
		if name != "" {
			delete(s.configured, name)
		}
		if e.User.ID != "" {
			delete(s.configuredIDs, e.User.ID)
		}
	} else if e.User.Name != "" {
		if e.User.ID != "" {
			old := s.configuredIDs[e.User.ID]
			if old != "" && old != e.User.Name {
				delete(s.configured, old)
			}
			s.configuredIDs[e.User.ID] = e.User.Name
		}
		if e.User.Disabled {
			delete(s.configured, e.User.Name)
		} else {
			s.configured[e.User.Name] = e.User
		}
	}
	events := s.reconcileLocked()
	s.mu.Unlock()
	s.emit(events)
}

func (s *hotspotInactiveState) onActive(row *roslib.Sentence) {
	s.mu.Lock()
	id := row.Get(".id")
	name := row.Get("user")
	if row.Get(".dead") == "true" {
		if name == "" {
			name = s.activeIDs[id]
		}
		s.removeActiveLocked(id, name)
	} else if name != "" {
		s.setActiveLocked(id, name)
	}
	events := s.reconcileLocked()
	s.mu.Unlock()
	s.emit(events)
}

func (s *hotspotInactiveState) setActiveLocked(id, name string) {
	if id == "" {
		if s.activeCounts[name] == 0 {
			s.activeCounts[name] = 1
		}
		return
	}
	old := s.activeIDs[id]
	if old == name {
		return
	}
	if old != "" {
		s.decrementActiveLocked(old)
	}
	s.activeIDs[id] = name
	s.activeCounts[name]++
}

func (s *hotspotInactiveState) removeActiveLocked(id, name string) {
	if id != "" {
		delete(s.activeIDs, id)
	}
	if name != "" {
		s.decrementActiveLocked(name)
	}
}

func (s *hotspotInactiveState) decrementActiveLocked(name string) {
	if s.activeCounts[name] <= 1 {
		delete(s.activeCounts, name)
		return
	}
	s.activeCounts[name]--
}

func (s *hotspotInactiveState) reconcileLocked() []HotspotInactiveEvent {
	next := make(map[string]domain.HotspotUser)
	for name, user := range s.configured {
		if s.activeCounts[name] == 0 {
			next[name] = user
		}
	}
	events := make([]HotspotInactiveEvent, 0)
	for name, prev := range s.inactive {
		cur, ok := next[name]
		if !ok {
			events = append(events, HotspotInactiveEvent{User: prev, Action: inactiveActionRemoved})
			continue
		}
		if cur != prev {
			events = append(events, HotspotInactiveEvent{User: cur, Action: inactiveActionChanged})
		}
	}
	for name, cur := range next {
		if _, ok := s.inactive[name]; !ok {
			events = append(events, HotspotInactiveEvent{User: cur, Action: inactiveActionAdded})
		}
	}
	s.inactive = next
	return events
}

func (s *hotspotInactiveState) emit(events []HotspotInactiveEvent) {
	if len(events) == 0 || s.h == nil {
		return
	}
	s.emitMu.Lock()
	defer s.emitMu.Unlock()
	for _, event := range events {
		s.h(event)
	}
}
