# AGENTS.md — Business Layer Extension

> Ekstensi dari `AGENTS.md` rosmon yang sudah ada di repo.
> Semua aturan AGENTS.md lama tetap berlaku untuk `mikrotik/`, `scripts/`,
> `workflows/`, dan `domain/`. Dokumen ini menambahkan konvensi untuk
> business layer baru: `store/`, `service/`, `api/handler/`, `api/dto/`,
> `job/`.
>
> Branch: `feat/backend-integration`

---

## Konteks Proyek

Business layer ISP management dibangun langsung di repo ini.
Tidak ada repo terpisah.

**Layer yang sudah ada — jangan diubah tanpa alasan kuat:**

| Layer | Package | Status |
|---|---|---|
| MikroTik clients | `mikrotik/` | Production-ready, jangan diubah |
| Script generators | `scripts/` | Production-ready |
| Cascade workflows | `workflows/` | Production-ready |
| Auth system | `service/auth/`, `api/middleware/auth.go` | Done — roles: admin/operator/viewer |
| Rate limiting | `api/middleware/ratelimit.go`, `internal/ratelimit/` | Done |
| Device encryption | `store/crypto.go` | Done — AES-256-GCM |
| SSE hub + cap | `api/sse/` | Done — `NewHubWithCaps(maxPerTopic, maxPerDevice)` |
| ProfileConfig API | `api/handler/profile_config.go` | Done |
| Duration utilities | `internal/rosfmt/duration.go` | Done — ParseDuration, FormatDuration, NormalizeDuration |

---

## Keputusan Arsitektur yang Sudah Baku

Tidak boleh didiskusikan ulang kecuali ada perubahan eksplisit dari
pemilik proyek:

1. **MikroTik adalah source of truth operasional.** DB menyimpan intended
   state. `pppoe_username` adalah satu-satunya join key ke router.

2. **DB-first write + outbox.** Setiap mutasi subscription:
   tulis DB dulu (set `mikrotik_sync_status = pending_*`), kembalikan
   HTTP response, sync ke MikroTik di background goroutine dengan
   `FOR UPDATE SKIP LOCKED`.

3. **Anniversary billing.** `subscription.billing_day` adalah tanggal
   tagih per subscription. Null → fallback ke
   `system_settings['billing.default_billing_day']`.

4. **Dua strategi suspend:** isolir (ganti profil MikroTik ke kecepatan
   rendah — nama profil dari `system_settings`) dan suspend keras
   (disable PPPoE secret).

5. **Notifikasi hanya via `service/notification`.** Tidak ada direct
   HTTP call ke go-wa dari handler atau service lain.

6. **Role staff: admin > operator > viewer.** Konstanta ada di
   `service/auth/errors.go`: `auth.RoleAdmin`, `auth.RoleOperator`,
   `auth.RoleViewer`. Tidak ada Casbin. Role check via
   `middleware.RequireRole(auth.RoleAdmin)`.

7. **Customer scope terpisah.** JWT customer pakai `auth.CustomerClaims`
   (berbeda dari `auth.Claims` staff). Middleware berbeda:
   `middleware.RequireCustomerAuth(signer)`.

8. **AutoMigrate, bukan goose.** DB migration via `store/migrate.go`
   yang di-extend setiap ada model baru. Setiap PR dengan model baru
   wajib update `store/migrate.go` dalam commit yang sama.

---

## Aturan Wajib Business Layer

1. **Service tidak punya HTTP dependency.** `service/*` tidak import
   `github.com/gin-gonic/gin`. Input/output berupa domain struct atau
   primitive.

2. **Store tidak punya business logic.** `store/*` hanya DB access.
   Kalkulasi billing, kondisi status, dst ada di service.

3. **Job harus idempotent.** Aman dijalankan ulang tanpa side effect
   ganda. Gunakan DB unique constraint sebagai guard.

4. **Aksi yang mengubah status entitas utama dicatat di `audit_logs`.**
   Gunakan helper `audit.Log(ctx, userID, action, entityType, entityID,
   oldJSON, newJSON)`. User ID 0 = aksi sistem.

5. **Password dan credential tidak boleh masuk log atau response.**
   `pppoe_password` dan `portal_password_hash` tidak masuk DTO response
   manapun dalam kondisi apapun.

6. **Notification log selalu ditulis** meski pengiriman gagal.
   Status `failed` + `next_retry_at` untuk retry oleh `job/notif_retry.go`.

7. **Tidak ada hardcoded konfigurasi.** Nilai yang bisa berubah
   (nama profil isolir, grace period, dsb) harus dibaca dari
   `store/model/SystemSetting` via `SettingStore`, bukan konstanta
   di kode.

8. **Context cancellation check wajib di loop panjang** (job, outbox):
   ```go
   for _, item := range items {
       select {
       case <-ctx.Done(): return ctx.Err()
       default:
       }
       // proses item...
   }
   ```

---

## Konvensi Store (store/)

**Pattern:** interface public + private GORM implementation.
Ikuti persis pola `store/user_store.go` yang sudah ada:

```go
// store/customer_store.go

// CustomerStore membungkus CRUD model.Customer.
type CustomerStore interface {
    GetByID(ctx context.Context, id uint) (model.Customer, error)
    GetByPhone(ctx context.Context, phone string) (model.Customer, error)
    List(ctx context.Context, f CustomerFilter) ([]model.Customer, int64, error)
    Create(ctx context.Context, c *model.Customer) error
    Update(ctx context.Context, c *model.Customer) error
    SoftDelete(ctx context.Context, id uint) error
}

type gormCustomerStore struct{ db *gorm.DB }

func NewCustomerStore(db *gorm.DB) CustomerStore {
    return &gormCustomerStore{db: db}
}
```

**Sentinel errors:** tambahkan ke `store/errors.go` baru (saat ini hanya
`ErrUserNotFound` di `store/user_store.go`):

```go
// store/errors.go
var (
    ErrNotFound   = errors.New("store: record not found")
    ErrDuplicate  = errors.New("store: duplicate entry")
    ErrConstraint = errors.New("store: constraint violation")
)
```

**List selalu return `([]T, int64, error)`** — slice + total count.
Tidak boleh return count terpisah (N+1 query).

**Filter struct per resource:**
```go
type CustomerFilter struct {
    Status   string
    Area     string
    Search   string // partial match nama atau phone
    Page     int    // 1-based
    PageSize int    // default 20, max 100
}
```

**Outbox query — pakai `FOR UPDATE SKIP LOCKED`:**
```go
func (s *gormSubscriptionStore) PendingSync(ctx context.Context, limit int) ([]model.Subscription, error) {
    var subs []model.Subscription
    err := s.db.WithContext(ctx).
        Where("mikrotik_sync_status != ?", "synced").
        Order("updated_at ASC").
        Limit(limit).
        Clauses(clause.Locking{Strength: "UPDATE", Options: "SKIP LOCKED"}).
        Find(&subs).Error
    return subs, err
}
```

---

## Konvensi Service (service/)

**Satu direktori per domain:** `service/<domain>/service.go`

**Constructor dengan deps struct** untuk service dengan banyak dependency:

```go
// service/billing/service.go

type Deps struct {
    Invoices      store.InvoiceStore
    Payments      store.PaymentStore
    Subscriptions store.SubscriptionStore
    Notification  *notification.Service
    Settings      store.SettingStore
    AuditLog      store.AuditLogStore
    NowFunc       func() time.Time // injectable untuk test
}

type Service struct{ d Deps }

func New(d Deps) *Service {
    if d.NowFunc == nil {
        d.NowFunc = time.Now
    }
    return &Service{d: d}
}
```

**Jangan pakai `time.Now()` langsung** — inject via `NowFunc` agar
bisa di-override di test tanpa manipulasi global state.

**Method yang menyentuh MikroTik lewat outbox:**

```go
// service/subscription/service.go
func (s *Service) Isolir(ctx context.Context, subID uint, byUserID uint) error {
    sub, err := s.d.Subs.GetByID(ctx, subID)
    if err != nil { return err }
    if sub.Status != domain.SubscriptionActive {
        return fmt.Errorf("subscription %d bukan active (status: %s)", subID, sub.Status)
    }

    old := sub // snapshot untuk audit

    // DB-first: tulis intended state + mark outbox
    if err := s.d.Subs.UpdateStatus(ctx, subID, domain.SubscriptionIsolir, domain.SyncPendingProfileChange); err != nil {
        return fmt.Errorf("update subscription: %w", err)
    }

    // Audit — non-fatal
    s.d.AuditLog.Log(ctx, byUserID, "isolir", "Subscription", subID, old, sub)

    // Notifikasi — best effort, async
    s.d.Notification.NotifyAsync(sub.CustomerID, "service_isolir", map[string]string{
        "customer_name": sub.Customer.FullName,
    })

    return nil
    // MikroTik sync dilakukan oleh outbox goroutine di background
}
```

---

## Konvensi Handler (api/handler/)

Ikuti konvensi existing AGENTS.md (handler tipis, `Register(g *gin.RouterGroup)`).
Tambahan untuk business layer:

**Helper context untuk claims:**

```go
// Sudah ada di api/middleware/auth.go — pakai ini:
claims, ok := middleware.ClaimsFrom(c)  // staff JWT
// Tambah nanti:
custClaims := middleware.MustCustomerClaims(c)  // customer JWT
```

**Error mapping — tambah ke `api/handler/helpers.go`:**

```go
func WriteServiceErr(c *gin.Context, err error) {
    switch {
    case errors.Is(err, store.ErrNotFound):
        WriteErr(c, http.StatusNotFound, "NOT_FOUND", err.Error())
    case errors.Is(err, store.ErrDuplicate):
        WriteErr(c, http.StatusConflict, "DUPLICATE", err.Error())
    default:
        // Log detail ke logrus, jangan expose ke client
        WriteErr(c, http.StatusInternalServerError, "INTERNAL", "internal server error")
    }
}
```

**File terpisah untuk customer portal:**
```
api/handler/customer.go         → admin manage customer (CRUD)
api/handler/customer_portal.go  → customer self-service (/api/customer/*)
```

---

## Konvensi DTO (api/dto/)

**Tiga jenis struct per resource di satu file:**

```go
// api/dto/customer.go

type CreateCustomerRequest struct {
    FullName string `json:"full_name" binding:"required,min=2,max=200"`
    Phone    string `json:"phone"     binding:"required"`
    Address  string `json:"address"   binding:"required"`
    Area     string `json:"area"`
    Notes    string `json:"notes"`
}

type UpdateCustomerRequest struct {
    FullName string `json:"full_name" binding:"omitempty,min=2"`
    Address  string `json:"address"`
    Area     string `json:"area"`
    Notes    string `json:"notes"`
}

type CustomerResponse struct {
    ID        uint   `json:"id"`
    FullName  string `json:"full_name"`
    Phone     string `json:"phone"`
    Address   string `json:"address"`
    Area      string `json:"area"`
    Status    string `json:"status"`
    CreatedAt string `json:"created_at"` // RFC3339
    // TIDAK ada: portal_password_hash
}

func CustomerResponseFrom(m model.Customer) CustomerResponse { ... }

func (r CreateCustomerRequest) ToModel() *model.Customer { ... }
```

---

## Konvensi Job (job/)

```go
// job/billing_cron.go

type BillingCron struct {
    invoices      store.InvoiceStore
    subscriptions store.SubscriptionStore
    billing       *billing.Service
    notification  *notification.Service
    log           *logrus.Entry
}

func NewBillingCron(/* deps */) *BillingCron { ... }

// Run adalah entry point. Harus idempotent.
func (j *BillingCron) Run(ctx context.Context) error {
    j.log.Info("billing cron: start")
    // ...
    return nil
}
```

Wire di `cmd/server/main.go`:
```go
c := cron.New(cron.WithLocation(time.Local))
c.AddFunc("0 7 * * *", func() { billingCron.Run(context.Background()) })
c.AddFunc("0 9 * * *", func() { suspensionCheck.Run(context.Background()) })
c.Start()
defer c.Stop()
```

---

## Naming Conventions Business Layer

| Kategori | Pola | Contoh |
|---|---|---|
| Store interface | `<Entity>Store` | `CustomerStore`, `InvoiceStore` |
| Store constructor | `New<Entity>Store(db)` | `NewCustomerStore(db)` |
| Store read | `GetBy<Field>` | `GetByID`, `GetByPhone` |
| Store list | `List(ctx, Filter)` | `List(ctx, CustomerFilter{})` |
| Service method | verb + noun | `ActivateSubscription`, `GenerateInvoice` |
| Job struct | noun + purpose | `BillingCron`, `SuspensionCheck` |
| Job entry | `Run(ctx) error` | selalu |
| DTO request | `<Action><Entity>Request` | `CreateCustomerRequest` |
| DTO response | `<Entity>Response` | `CustomerResponse` |
| DTO mapper | `<Entity>ResponseFrom` | `CustomerResponseFrom(m model.Customer)` |
| Status constant | `<Entity><Status>` | `SubscriptionActive`, `InvoicePaid` |
| Notification slug | lowercase underscore | `"invoice_issued"`, `"service_isolir"` |

---

## Route Zone Convention

Tiga zone auth di `api/routes.go`:

```go
// Zone 1: public
public := g.Group("")  // tanpa middleware auth
public.POST("/public/registrations", ...)
public.POST("/public/customer/auth/otp/request", ...)
public.POST("/public/customer/auth/otp/verify", ...)

// Zone 2: staff (ikuti pola yang sudah ada)
// roleAdmin, roleOperator, roleViewer sudah ada di routes.go
// Untuk admin-only:
adminGroup.Use(middleware.RequireRole(roleAdmin))
// Untuk operator+:
staffGroup.Use(middleware.RequireRole(roleAdmin, roleOperator))
// Viewer bisa akses semua GET → cukup RequireAuth

// Zone 3: customer portal (setelah CustomerClaims tersedia)
customerGroup := g.Group("/customer")
customerGroup.Use(middleware.RequireCustomerAuth(deps.AuthSigner))
```

---

## Dependency yang Diizinkan

Dari `go.mod` yang sudah ada, semua ini **sudah tersedia**:
- `gorm.io/gorm` + `gorm.io/driver/postgres`
- `github.com/golang-jwt/jwt/v5`
- `golang.org/x/crypto` (bcrypt)
- `golang.org/x/time` (rate limiting)
- `github.com/google/uuid`
- `github.com/sirupsen/logrus`

**Yang perlu ditambah untuk business layer:**
```
github.com/robfig/cron/v3    → job scheduler
```

**Tidak perlu ditambahkan:**
- Casbin — role check sudah cukup `RequireRole`
- Wire/dig — DI manual cukup
- Kafka/NATS — notification retry via DB sudah cukup
- goose — pakai GORM AutoMigrate yang sudah ada

Sebelum tambah dependency baru: cek go.mod, diskusikan dulu.

---

## Checklist PR Business Layer

Setiap PR yang menambah fitur business baru harus mengandung:

```
□ store/model/<entity>.go           — model GORM + domain status constants
□ store/<entity>_store.go           — interface + gorm impl + filter struct
□ service/<domain>/service.go       — business logic (extend jika ada)
□ service/<domain>/service_test.go  — minimal happy path + 1 error case
□ api/dto/<entity>.go               — Request + Response + mapper
□ api/handler/<entity>.go           — Register(g), handler tipis
□ update api/routes.go              — daftarkan route baru
□ update api/deps.go                — tambah deps jika ada
□ update store/migrate.go           — tambah model baru ke AutoMigrate
□ update cmd/server/main.go         — wire service baru
□ update docs/openapi/              — spec endpoint baru, lalu bundle
```

**PR ditolak jika:**
- Ada model baru tapi `store/migrate.go` tidak diupdate
- Ada service method baru tapi tidak ada test
- Ada endpoint baru tapi OpenAPI tidak diupdate
- Ada `time.Now()` langsung di service (harus via `NowFunc`)
- Ada credential di log atau response DTO

---

## Yang Harus Dihindari (Tambahan)

- ❌ Business logic di handler.
- ❌ DB query langsung di handler.
- ❌ Direct HTTP call ke go-wa dari luar `service/notification/`.
- ❌ Hardcode nama profil MikroTik atau grace period — selalu dari `system_settings`.
- ❌ Sync MikroTik synchronous dari HTTP handler untuk mutasi subscription.
- ❌ `time.Now()` di service tanpa injectable override.
- ❌ `panic` di service atau store.
- ❌ Log `pppoe_password` atau `portal_password_hash`.
- ❌ Skip audit log untuk aksi yang ubah status subscription/invoice/payment.
- ❌ Tambah kolom ke model existing tanpa migration (AutoMigrate handle ADD COLUMN, tapi schema change lain butuh perhatian).