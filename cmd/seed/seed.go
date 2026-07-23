package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	roslib "github.com/quiqxiq/roslib"
	"github.com/quiqxiq/rosmon/domain"
	"github.com/quiqxiq/rosmon/mikrotik"
	mkhot "github.com/quiqxiq/rosmon/mikrotik/hotspot"
	mkppp "github.com/quiqxiq/rosmon/mikrotik/ppp"
	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/quiqxiq/rosmon/workflows"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

const voucherOutputFile = "docker/mikrotik/.vouchers.json"

type seeder struct {
	db  *gorm.DB
	log *logrus.Logger

	targetDeviceID uint // dari flag --device-id (0 = auto)
	deviceID       uint
	device         model.MikrotikDevice

	deviceStore   store.DeviceStore
	pppStore      store.PPPProfileStore
	hotspotStore  store.HotspotProfileStore
	customerStore store.CustomerStore
	subStore      store.SubscriptionStore

	// stats
	pppCreated    int
	pppSkipped    int
	hpCreated     int
	hpSkipped     int
	custCreated   int
	custSkipped   int
	subCreated    int
	subSkipped    int
	secretCreated int
	secretSkipped int
	hsUserCreated int
	hsUserSkipped int
	voucherCount  int
	voucherFile   string
}

func newSeeder(db *gorm.DB, log *logrus.Logger, targetDeviceID uint) *seeder {
	return &seeder{
		db:             db,
		log:            log,
		targetDeviceID: targetDeviceID,
		deviceStore:    store.NewDeviceStore(db),
		pppStore:       store.NewPPPProfileStore(db),
		hotspotStore:   store.NewHotspotProfileStore(db),
		customerStore:  store.NewCustomerStore(db),
		subStore:       store.NewSubscriptionStore(db),
	}
}

// ─── Device resolution ─────────────────────────────────────────────────────

func (s *seeder) resolveDevice(ctx context.Context) error {
	devices, err := s.deviceStore.List(ctx)
	if err != nil {
		return fmt.Errorf("gagal list device: %w", err)
	}
	if len(devices) == 0 {
		return fmt.Errorf(
			"tidak ada MikrotikDevice terdaftar di database.\n" +
				"  → Daftarkan router terlebih dahulu via web UI (menu Routers → Add Router),\n" +
				"    lalu jalankan seeder kembali.")
	}

	// --device-id diberikan: cari device tersebut.
	if s.targetDeviceID > 0 {
		for _, d := range devices {
			if d.ID == s.targetDeviceID {
				s.device = d
				s.deviceID = d.ID
				s.log.WithField("id", d.ID).WithField("device", d.DisplayName).Info("menggunakan device (--device-id)")
				return nil
			}
		}
		// Tampilkan daftar agar user mudah memilih.
		s.log.Errorf("device ID %d tidak ditemukan. Device yang terdaftar:", s.targetDeviceID)
		for _, d := range devices {
			s.log.Errorf("  id=%-3d  %s  (%s:%d)", d.ID, d.DisplayName, d.Host, d.Port)
		}
		return fmt.Errorf("device ID %d tidak ditemukan — gunakan salah satu ID di atas", s.targetDeviceID)
	}

	// Tidak ada flag: auto-pilih jika hanya 1 device.
	if len(devices) == 1 {
		s.device = devices[0]
		s.deviceID = s.device.ID
		s.log.WithField("id", s.device.ID).WithField("device", s.device.DisplayName).Info("auto-pilih satu-satunya device")
		return nil
	}

	// 2+ device dan tidak ada --device-id: tampilkan pilihan lalu error.
	fmt.Println()
	fmt.Println("  Ada lebih dari satu MikroTik device terdaftar:")
	fmt.Println()
	for _, d := range devices {
		fmt.Printf("    --device-id=%-3d  %s  (%s:%d)\n", d.ID, d.DisplayName, d.Host, d.Port)
	}
	fmt.Println()
	return fmt.Errorf("tentukan device dengan flag --device-id=<ID>")
}

// ─── Fase 1: DB ────────────────────────────────────────────────────────────

func (s *seeder) seedDB(ctx context.Context) error {
	if err := s.resolveDevice(ctx); err != nil {
		return err
	}

	if err := s.seedPPPProfiles(ctx); err != nil {
		return fmt.Errorf("ppp profiles: %w", err)
	}
	if err := s.seedHotspotProfiles(ctx); err != nil {
		return fmt.Errorf("hotspot profiles: %w", err)
	}
	if err := s.seedCustomersAndSubs(ctx); err != nil {
		return fmt.Errorf("customers/subs: %w", err)
	}
	return nil
}

// ─── Data definitions ──────────────────────────────────────────────────────

type pppProfileDef struct {
	Name, RateLimit, RemoteAddress, Description string
	PriceMonthly                                int64
}

func pppProfileDefs() []pppProfileDef {
	return []pppProfileDef{
		{"paket-bronze", "10M/5M", "", "Paket Bronze 10Mbps down / 5Mbps up", 150000},
		{"paket-silver", "20M/10M", "", "Paket Silver 20Mbps down / 10Mbps up", 250000},
		{"paket-gold", "50M/25M", "", "Paket Gold 50Mbps down / 25Mbps up", 400000},
	}
}

type hotspotProfileDef struct {
	Name, Role, RateLimit, AddressPool, ExpiryMode, Validity, Description string
	PriceMonthly                                                           int64
	Price, SellPrice                                                       int
}

func hotspotProfileDefs() []hotspotProfileDef {
	return []hotspotProfileDef{
		{Name: "hs-basic", Role: "permanent", RateLimit: "5M/5M", AddressPool: "", PriceMonthly: 100000, Description: "Hotspot Basic 5Mbps (bulanan)"},
		{Name: "hs-kantor", Role: "permanent", RateLimit: "20M/20M", AddressPool: "", PriceMonthly: 250000, Description: "Hotspot Kantor 20Mbps (bulanan)"},
		{Name: "hs-harian", Role: "voucher", RateLimit: "5M/5M", ExpiryMode: "rem", Validity: "1d", Price: 3000, SellPrice: 5000, Description: "Voucher Harian 5Mbps / 1 hari"},
		{Name: "hs-mingguan", Role: "voucher", RateLimit: "10M/10M", ExpiryMode: "rem", Validity: "7d", Price: 10000, SellPrice: 15000, Description: "Voucher Mingguan 10Mbps / 7 hari"},
	}
}

type customerDef struct {
	FullName, Phone, Area, Username, Password, ServiceType, ProfileName string
	BillingDay                                                           int
}

func customerDefs() []customerDef {
	return []customerDef{
		// PPPoE (5)
		{"Budi Santoso", "08111000001", "Selatan", "pppoe-user1", "Pppoe@1122", "pppoe", "paket-bronze", 1},
		{"Siti Rahayu", "08111000002", "Utara", "pppoe-user2", "Pppoe@2233", "pppoe", "paket-silver", 5},
		{"Agus Wijaya", "08111000003", "Timur", "pppoe-user3", "Pppoe@3344", "pppoe", "paket-gold", 10},
		{"Dewi Kusuma", "08111000004", "Barat", "pppoe-user4", "Pppoe@4455", "pppoe", "paket-bronze", 15},
		{"Hendra Putra", "08111000005", "Pusat", "pppoe-user5", "Pppoe@5566", "pppoe", "paket-silver", 20},
		// Hotspot permanent (3)
		{"Ani Marlina", "08111000011", "Selatan", "hs-perm1", "HsPerm@11", "hotspot", "hs-basic", 1},
		{"Doni Pratama", "08111000012", "Utara", "hs-perm2", "HsPerm@22", "hotspot", "hs-kantor", 5},
		{"Rina Wati", "08111000013", "Timur", "hs-perm3", "HsPerm@33", "hotspot", "hs-basic", 10},
	}
}

// ─── PPP Profiles ──────────────────────────────────────────────────────────

func (s *seeder) seedPPPProfiles(ctx context.Context) error {
	for _, def := range pppProfileDefs() {
		if _, err := s.pppStore.GetByName(ctx, s.deviceID, def.Name); err == nil {
			s.log.WithField("name", def.Name).Debug("ppp profile sudah ada, skip")
			s.pppSkipped++
			continue
		}
		p := &model.PPPProfile{
			DeviceID:      s.deviceID,
			Name:          def.Name,
			RateLimit:     def.RateLimit,
			PriceMonthly:  def.PriceMonthly,
			RemoteAddress: def.RemoteAddress,
			Description:   def.Description,
			Active:        true,
			IsPublic:      true,
		}
		if err := s.pppStore.Create(ctx, p); err != nil {
			return fmt.Errorf("create ppp profile %q: %w", def.Name, err)
		}
		s.log.WithField("name", def.Name).Info("ppp profile dibuat")
		s.pppCreated++
	}
	return nil
}

// ─── Hotspot Profiles ──────────────────────────────────────────────────────

func (s *seeder) seedHotspotProfiles(ctx context.Context) error {
	for _, def := range hotspotProfileDefs() {
		if _, err := s.hotspotStore.GetByName(ctx, s.deviceID, def.Name); err == nil {
			s.log.WithField("name", def.Name).Debug("hotspot profile sudah ada, skip")
			s.hpSkipped++
			continue
		}
		p := &model.HotspotProfile{
			DeviceID:     s.deviceID,
			Name:         def.Name,
			Role:         def.Role,
			RateLimit:    def.RateLimit,
			AddressPool:  def.AddressPool,
			PriceMonthly: def.PriceMonthly,
			ExpiryMode:   def.ExpiryMode,
			Validity:     def.Validity,
			Price:        def.Price,
			SellPrice:    def.SellPrice,
			Description:  def.Description,
			SharedUsers:  1,
			Active:       true,
			IsPublic:     def.Role == "permanent",
		}
		if err := s.hotspotStore.Create(ctx, p); err != nil {
			return fmt.Errorf("create hotspot profile %q: %w", def.Name, err)
		}
		s.log.WithField("name", def.Name).WithField("role", def.Role).Info("hotspot profile dibuat")
		s.hpCreated++
	}
	return nil
}

// ─── Customers + Subscriptions ─────────────────────────────────────────────

func (s *seeder) seedCustomersAndSubs(ctx context.Context) error {
	pppProfiles, err := s.pppStore.ListByDevice(ctx, s.deviceID)
	if err != nil {
		return fmt.Errorf("list ppp profiles: %w", err)
	}
	pppByName := make(map[string]model.PPPProfile, len(pppProfiles))
	for _, p := range pppProfiles {
		pppByName[p.Name] = p
	}

	hpAll, err := s.hotspotStore.ListByDevice(ctx, s.deviceID, store.HotspotProfileListFilter{})
	if err != nil {
		return fmt.Errorf("list hotspot profiles: %w", err)
	}
	hpByName := make(map[string]model.HotspotProfile, len(hpAll))
	for _, p := range hpAll {
		hpByName[p.Name] = p
	}

	for _, def := range customerDefs() {
		// Customer — idempotent via phone lookup.
		cust, custErr := s.customerStore.GetByPhone(ctx, def.Phone)
		if custErr != nil {
			cust = model.Customer{FullName: def.FullName, Phone: def.Phone, Area: def.Area, Status: "aktif"}
			if err := s.customerStore.Create(ctx, &cust); err != nil {
				return fmt.Errorf("create customer %q: %w", def.Phone, err)
			}
			s.log.WithField("name", def.FullName).Info("customer dibuat")
			s.custCreated++
		} else {
			s.log.WithField("name", def.FullName).Debug("customer sudah ada, skip")
			s.custSkipped++
		}

		// Subscription — idempotent via unique index (DeviceID, ServiceType, MikrotikUsername).
		bd := def.BillingDay
		nextInvoice := time.Now().AddDate(0, 1, 0)
		sub := &model.Subscription{
			CustomerID:       cust.ID,
			DeviceID:         s.deviceID,
			ServiceType:      def.ServiceType,
			MikrotikUsername: def.Username,
			MikrotikPassword: def.Password,
			BillingDay:       &bd,
			NextInvoiceDate:  &nextInvoice,
			Status:           "active",
			SyncStatus:       "pending_create",
		}
		if def.ServiceType == "pppoe" {
			prof, ok := pppByName[def.ProfileName]
			if !ok {
				return fmt.Errorf("ppp profile %q tidak ditemukan", def.ProfileName)
			}
			sub.PPPProfileID = &prof.ID
		} else {
			prof, ok := hpByName[def.ProfileName]
			if !ok {
				return fmt.Errorf("hotspot profile %q tidak ditemukan", def.ProfileName)
			}
			sub.HotspotProfileID = &prof.ID
		}

		if err := s.subStore.Create(ctx, sub); err != nil {
			if store.IsUniqueViolation(err) || errors.Is(err, store.ErrSubscriptionUsernameTaken) {
				s.log.WithField("username", def.Username).Debug("subscription sudah ada, skip")
				s.subSkipped++
				continue
			}
			return fmt.Errorf("create subscription %q: %w", def.Username, err)
		}
		s.log.WithField("username", def.Username).WithField("type", def.ServiceType).Info("subscription dibuat")
		s.subCreated++
	}
	return nil
}

// ─── Fase 2: MikroTik Direct ───────────────────────────────────────────────

func (s *seeder) seedMikroTik(ctx context.Context, force bool) error {
	addr := s.device.Host + ":" + strconv.Itoa(s.device.Port)
	s.log.WithField("addr", addr).Info("dial ke MikroTik")

	dev, err := roslib.New(ctx, roslib.Options{
		Address:             addr,
		Username:            s.device.Username,
		Password:            s.device.Password,
		DialTimeout:         15 * time.Second,
		ReconnectMaxElapsed: 30 * time.Second,
		Logger:              s.log,
	})
	if err != nil {
		return fmt.Errorf("dial %s: %w", addr, err)
	}
	defer dev.CloseAndWait()

	wf := workflows.New(dev)

	if err := s.syncRouterOSPPPProfiles(ctx, wf.PPP); err != nil {
		return err
	}
	if err := s.syncRouterOSHotspotProfiles(ctx, wf.Hotspot); err != nil {
		return err
	}
	if err := s.syncPPPSecrets(ctx, wf.PPP); err != nil {
		return err
	}
	if err := s.syncHotspotUsers(ctx, wf.Hotspot); err != nil {
		return err
	}
	if err := s.generateVouchers(ctx, wf, force); err != nil {
		return err
	}
	s.markSynced(ctx)
	return nil
}

func (s *seeder) syncRouterOSPPPProfiles(ctx context.Context, pppC *mkppp.Client) error {
	for _, def := range pppProfileDefs() {
		_, err := pppC.ProfileAdd(ctx, mkppp.ProfileAddArgs{
			Name:       def.Name,
			RateLimit:  def.RateLimit,
			RemoteAddr: def.RemoteAddress,
		})
		if err != nil {
			if isAlreadyExistsErr(err) {
				s.log.WithField("name", def.Name).Debug("RouterOS ppp profile sudah ada, skip")
				continue
			}
			return fmt.Errorf("RouterOS ppp profile %q: %w", def.Name, err)
		}
		s.log.WithField("name", def.Name).Info("RouterOS ppp profile dibuat")
	}
	return nil
}

func (s *seeder) syncRouterOSHotspotProfiles(ctx context.Context, hotC *mkhot.Client) error {
	for _, def := range hotspotProfileDefs() {
		_, err := hotC.ProfileAdd(ctx, mkhot.ProfileAddArgs{
			Name:        def.Name,
			RateLimit:   def.RateLimit,
			AddressPool: def.AddressPool,
			SharedUsers: "1",
		})
		if err != nil {
			if isAlreadyExistsErr(err) {
				s.log.WithField("name", def.Name).Debug("RouterOS hotspot profile sudah ada, skip")
				continue
			}
			return fmt.Errorf("RouterOS hotspot profile %q: %w", def.Name, err)
		}
		s.log.WithField("name", def.Name).Info("RouterOS hotspot profile dibuat")
	}
	return nil
}

func isAlreadyExistsErr(err error) bool {
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "already have") || strings.Contains(msg, "already exists") || strings.Contains(msg, "failure: already")
}

func (s *seeder) syncPPPSecrets(ctx context.Context, pppC *mkppp.Client) error {
	for _, def := range customerDefs() {
		if def.ServiceType != "pppoe" {
			continue
		}
		existing, err := pppC.SecretByName(ctx, def.Username)
		if err == nil {
			// Secret sudah ada — pastikan profile-nya benar.
			if existing.Profile != def.ProfileName {
				s.log.WithField("name", def.Username).
					WithField("was", existing.Profile).
					WithField("want", def.ProfileName).
					Info("memperbaiki ppp secret profile")
				if setErr := pppC.SecretSet(ctx, mkppp.SecretSetArgs{
					ID:      existing.ID,
					Profile: def.ProfileName,
				}); setErr != nil {
					s.log.WithField("name", def.Username).WithError(setErr).Warn("gagal update ppp secret profile")
				}
			}
			s.secretSkipped++
			continue
		}
		if !errors.Is(err, mikrotik.ErrNotFound) {
			return fmt.Errorf("check ppp secret %q: %w", def.Username, err)
		}
		if _, err := pppC.SecretAdd(ctx, mkppp.SecretAddArgs{
			Name:     def.Username,
			Password: def.Password,
			Service:  "pppoe",
			Profile:  def.ProfileName,
		}); err != nil {
			return fmt.Errorf("add ppp secret %q: %w", def.Username, err)
		}
		s.log.WithField("name", def.Username).Info("ppp secret dibuat di MikroTik")
		s.secretCreated++
	}
	return nil
}

func (s *seeder) syncHotspotUsers(ctx context.Context, hotC *mkhot.Client) error {
	for _, def := range customerDefs() {
		if def.ServiceType != "hotspot" {
			continue
		}
		if _, err := hotC.UserByName(ctx, def.Username); err == nil {
			s.log.WithField("name", def.Username).Debug("hotspot user sudah ada, skip")
			s.hsUserSkipped++
			continue
		} else if !errors.Is(err, mikrotik.ErrNotFound) {
			return fmt.Errorf("check hotspot user %q: %w", def.Username, err)
		}
		if _, err := hotC.UserAdd(ctx, mkhot.UserAddArgs{
			Name:     def.Username,
			Password: def.Password,
			Profile:  def.ProfileName,
			Server:   "all",
		}); err != nil {
			return fmt.Errorf("add hotspot user %q: %w", def.Username, err)
		}
		s.log.WithField("name", def.Username).Info("hotspot user dibuat di MikroTik")
		s.hsUserCreated++
	}
	return nil
}

func (s *seeder) generateVouchers(ctx context.Context, wf *workflows.Clients, force bool) error {
	if !force {
		if _, statErr := os.Stat(voucherOutputFile); statErr == nil {
			s.log.WithField("file", voucherOutputFile).Info("voucher file sudah ada, skip (--force untuk re-generate)")
			if data, err := os.ReadFile(voucherOutputFile); err == nil {
				var existing []voucherEntry
				if json.Unmarshal(data, &existing) == nil {
					s.voucherCount = len(existing)
					s.voucherFile = voucherOutputFile
				}
			}
			return nil
		}
	}

	specs := []domain.VoucherSpec{
		{Server: "all", UserMode: "vc", Length: 8, Prefix: "vc",
			Charset: domain.CharsetMixNum, Profile: "hs-harian",
			Comment: "seed-voucher", Validity: "1d",
			Price: 3000, SellPrice: 5000, BatchSize: 5},
		{Server: "all", UserMode: "vc", Length: 8, Prefix: "vw",
			Charset: domain.CharsetMixNum, Profile: "hs-mingguan",
			Comment: "seed-voucher", Validity: "7d",
			Price: 10000, SellPrice: 15000, BatchSize: 5},
	}

	var entries []voucherEntry
	idx := 1
	for _, spec := range specs {
		s.log.WithField("profile", spec.Profile).WithField("batch", spec.BatchSize).Info("generate voucher hotspot")
		vouchers, genErr := workflows.GenerateVouchers(ctx, wf, spec)
		if genErr != nil {
			var batchErr *workflows.GenerateVouchersErr
			if errors.As(genErr, &batchErr) && len(batchErr.Created) > 0 {
				s.log.WithError(batchErr.Failed).Warnf("generate parsial %s: %d berhasil", spec.Profile, len(batchErr.Created))
				vouchers = batchErr.Created
			} else {
				return fmt.Errorf("generate vouchers %s: %w", spec.Profile, genErr)
			}
		}
		for _, v := range vouchers {
			entries = append(entries, voucherEntry{
				Index:    idx,
				Username: v.Username,
				Password: v.Password,
				Profile:  spec.Profile,
				Validity: spec.Validity,
			})
			idx++
		}
	}

	data, _ := json.MarshalIndent(entries, "", "  ")
	if err := os.WriteFile(voucherOutputFile, data, 0644); err != nil {
		s.log.WithError(err).Warnf("gagal simpan %s", voucherOutputFile)
	} else {
		s.log.WithField("file", voucherOutputFile).Infof("disimpan %d voucher", len(entries))
		s.voucherFile = voucherOutputFile
	}
	s.voucherCount = len(entries)
	return nil
}

type voucherEntry struct {
	Index    int    `json:"index"`
	Username string `json:"username"`
	Password string `json:"password"`
	Profile  string `json:"profile"`
	Validity string `json:"validity"`
}

func (s *seeder) markSynced(ctx context.Context) {
	subs, err := s.subStore.List(ctx, store.SubscriptionListFilter{DeviceID: s.deviceID})
	if err != nil {
		return
	}
	for _, sub := range subs {
		if sub.SyncStatus == "pending_create" {
			_ = s.subStore.UpdateSyncStatus(ctx, sub.ID, "synced", "seeded directly")
		}
	}
}
