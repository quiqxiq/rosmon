# Sistem Manajemen ISP — System Design & Architecture

> Dokumen ini adalah referensi desain untuk pengembangan business layer
> di atas rosmon (branch `feat/backend-integration`).
> Semua keputusan arsitektur dan skema database mengacu pada kondisi
> riil repo yang sudah ada.

---

## 1. Goals & Scope

### Tujuan Utama

Membangun sistem manajemen ISP/WiFi berbasis PPPoE dan Hotspot dalam satu
repo dan satu binary, dengan menambahkan business layer di atas MikroTik
layer yang sudah ada.

**Dua domain yang harus selalu dipisahkan:**

| Layer | Package | Isi |
|---|---|---|
| MikroTik layer | `mikrotik/`, `scripts/`, `workflows/` | Thin wrapper RouterOS — sudah ada, jangan diubah |
| Business layer | `service/`, `store/`, `job/` | Logika bisnis ISP — yang akan dibangun |
| HTTP layer | `api/handler/`, `api/dto/` | Request/Response — extend yang sudah ada |

### Empat Role

| Role | Akses | JWT scope |
|---|---|---|
| **admin** | Full access — semua device, customer, billing, system settings, user management | Staff JWT (`auth.Claims`) |
| **operator** | Operasional — CRUD hotspot/PPPoE, manage customer, eksekusi instalasi, tidak bisa manage billing global atau user admin | Staff JWT |
| **viewer** | Read-only — semua GET, SSE streaming | Staff JWT |
| **customer** | Self-service portal — data milik sendiri saja | Customer JWT (`auth.CustomerClaims`) |

`admin > operator > viewer` adalah hierarki staff.
`customer` adalah scope JWT terpisah, tidak bisa akses endpoint staff.

### Yang Tidak Masuk Scope Saat Ini

- Frontend (dikerjakan terpisah setelah backend selesai)
- Payment gateway otomatis (Xendit/Midtrans menyusul — fase berikutnya)
- Multi-tenant

---

## 2. Arsitektur Keseluruhan

```
┌────────────────────────────────────────────────────────────────┐
│                  rosmon (satu binary)                   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    HTTP Layer (Gin)                      │   │
│  │  /api/public/*    /api/v1/*         /api/customer/*      │   │
│  │  (no auth)        (staff JWT)       (customer JWT)       │   │
│  └──────────────────────────┬──────────────────────────────┘   │
│                             │                                   │
│  ┌──────────────────────────▼──────────────────────────────┐   │
│  │                   Service Layer                          │   │
│  │                                                          │   │
│  │  EXISTING:                    NEW (business layer):      │   │
│  │  devmgr  expiry  metrics auth  subscription  billing    │   │
│  │                               notification  registration  │   │
│  └──────────┬────────────────────────────┬──────────────────┘   │
│             │                            │                      │
│  ┌──────────▼──────────┐   ┌────────────▼──────────────────┐   │
│  │  MikroTik Layer     │   │       Database Layer           │   │
│  │  roslib + mikrotik/ │   │  PostgreSQL via GORM           │   │
│  │  ppp/ hotspot/ ...  │   │  Existing models + new tables  │   │
│  └──────────┬──────────┘   └───────────────────────────────┘   │
│             │                                                    │
│  ┌──────────▼──────────┐   ┌───────────────────────────────┐   │
│  │  Background Jobs     │   │     SSE Hub (sudah ada)       │   │
│  │  billing_cron        │   │     traffic, active, log      │   │
│  │  suspension_check    │   └───────────────────────────────┘   │
│  │  reconciler          │                                        │
│  │  notif_retry         │                                        │
│  └──────────────────────┘                                        │
└────────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
┌──────────────────┐         ┌─────────────────────┐
│  MikroTik        │         │  go-wa (self-hosted) │
│  Router(s)       │         │  WhatsApp Gateway    │
│  PPPoE + Hotspot │         └─────────────────────┘
└──────────────────┘
```

### Prinsip Utama

**MikroTik adalah source of truth operasional.** DB menyimpan
*intended state* dan *business data*. `pppoe_username` adalah
satu-satunya join key antara DB dan router.

**DB-first write pattern + outbox.** Semua perubahan yang butuh
MikroTik: tulis DB dulu (set `mikrotik_sync_status = pending_*`),
kembalikan HTTP response, sync ke MikroTik di background goroutine.

---

## 3. Struktur Direktori (Setelah Pengembangan)

```
rosmon/
│
├── mikrotik/               ← JANGAN DIUBAH
├── scripts/                ← JANGAN DIUBAH
├── workflows/              ← EXTEND: tambah PPPoE workflows
│   ├── pppoe_activate.go   (NEW)
│   ├── pppoe_isolir.go     (NEW)
│   └── pppoe_terminate.go  (NEW)
│
├── domain/                 ← EXTEND: tambah tipe bisnis
│   ├── ... existing ...
│   ├── subscription.go     (NEW — SubscriptionStatus, SyncStatus)
│   ├── billing.go          (NEW — InvoiceStatus, PaymentMethod)
│   └── notification.go     (NEW — NotifType, template slug constants)
│
├── store/
│   ├── model/
│   │   ├── ... existing (5 file) ...
│   │   ├── customer.go           (NEW)
│   │   ├── bandwidth_profile.go  (NEW)
│   │   ├── registration.go       (NEW)
│   │   ├── subscription.go       (NEW)
│   │   ├── invoice.go            (NEW)
│   │   ├── invoice_item.go       (NEW)
│   │   ├── payment.go            (NEW)
│   │   ├── sequence_counter.go   (NEW)
│   │   ├── system_setting.go     (NEW)
│   │   ├── message_template.go   (NEW)
│   │   └── audit_log.go          (NEW)
│   ├── ... existing stores ...
│   ├── customer_store.go         (NEW)
│   ├── bandwidth_profile_store.go(NEW)
│   ├── registration_store.go     (NEW)
│   ├── subscription_store.go     (NEW)
│   ├── invoice_store.go          (NEW)
│   ├── payment_store.go          (NEW)
│   ├── setting_store.go          (NEW)
│   ├── template_store.go         (NEW)
│   └── migrate.go                (EXTEND — tambah model baru)
│
├── service/
│   ├── ... existing (devmgr, expiry, metrics, auth) ...
│   ├── subscription/   (NEW — PPPoE lifecycle + outbox sync)
│   ├── billing/        (NEW — invoice, payment, auto-suspend)
│   └── notification/   (NEW — WA abstraction + retry)
│
├── api/
│   ├── handler/
│   │   ├── ... existing handlers ...
│   │   ├── customer.go           (NEW — admin manage customer)
│   │   ├── registration.go       (NEW — registration flow)
│   │   ├── bandwidth_profile.go  (NEW — paket PPPoE CRUD)
│   │   ├── subscription.go       (NEW — subscription lifecycle)
│   │   ├── billing.go            (NEW — invoice + payment admin)
│   │   ├── setting.go            (NEW — system settings)
│   │   └── customer_portal.go    (NEW — /api/customer/* endpoints)
│   ├── middleware/
│   │   ├── ... existing ...
│   │   └── auth.go               (EXTEND — tambah RequireCustomerAuth)
│   ├── deps.go                   (EXTEND — tambah deps baru)
│   └── routes.go                 (EXTEND — tambah 3 route zone baru)
│
└── job/                    (NEW)
    ├── billing_cron.go
    ├── suspension_check.go
    ├── reconciler.go
    └── notif_retry.go
```

---

## 4. Database Schema

### 4.1 Tabel Existing (Tetap, Extend Seperlunya)

**`users`** — extend field:
```sql
ALTER TABLE users ADD COLUMN full_name VARCHAR(128);
ALTER TABLE users ADD COLUMN phone     VARCHAR(20);
ALTER TABLE users ADD COLUMN last_login_at TIMESTAMPTZ;
-- role tetap: 'admin' | 'operator' | 'viewer'
-- customer TIDAK di sini — punya tabel customers sendiri
```

**`mikrotik_devices`** — tidak berubah.

**`transactions`** — ini VoucherSale (hotspot), tidak berubah.

**`hotspot_profile_configs`** — tidak berubah.

**`refresh_tokens`** — tidak berubah.

---

### 4.2 Config & System Tables

**`system_settings`**
```sql
CREATE TABLE system_settings (
    id          BIGSERIAL PRIMARY KEY,
    key         VARCHAR(100) UNIQUE NOT NULL,
    value       TEXT NOT NULL DEFAULT '',
    value_type  VARCHAR(20)  NOT NULL DEFAULT 'string',
    -- 'string' | 'int' | 'bool' | 'json'
    description TEXT,
    group_name  VARCHAR(50),
    -- 'billing' | 'notification' | 'mikrotik' | 'general'
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

Default keys (seed saat migrate):
```
billing.default_billing_day      = '1'
billing.invoice_due_days         = '7'
billing.isolir_after_days        = '3'
billing.hard_suspend_after_days  = '14'
billing.isolir_profile_name      = 'isolir'
notification.wa_enabled          = 'false'
notification.wa_api_url          = ''
notification.wa_sender           = ''
general.company_name             = ''
```

---

**`message_templates`**
```sql
CREATE TABLE message_templates (
    id        BIGSERIAL PRIMARY KEY,
    slug      VARCHAR(100) UNIQUE NOT NULL,
    name      VARCHAR(200) NOT NULL,
    body      TEXT NOT NULL,
    -- variabel dalam format {{.FieldName}}
    variables JSONB DEFAULT '[]',
    active    BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

Slug yang perlu di-seed:
```
registration_received, registration_approved, registration_rejected,
installation_complete, invoice_issued, invoice_reminder, invoice_overdue,
service_isolir, service_suspended, service_restored,
payment_confirmed, payment_rejected, package_changed
```

---

**`sequence_counters`**
```sql
CREATE TABLE sequence_counters (
    id         BIGSERIAL PRIMARY KEY,
    prefix     VARCHAR(20) NOT NULL,  -- 'INV', 'REG', 'CUST'
    year       SMALLINT NOT NULL,
    month      SMALLINT NOT NULL DEFAULT 0,
    last_value INTEGER  NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (prefix, year, month)
);
```

---

**`audit_logs`**
```sql
CREATE TABLE audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
    -- null = aksi sistem (cron, webhook)
    action      VARCHAR(50) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id   BIGINT,
    old_values  JSONB,
    new_values  JSONB,
    ip_address  VARCHAR(45),
    notes       TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_logs_time   ON audit_logs (created_at DESC);
```

---

### 4.3 Customer & Registration

**`customers`**
```sql
CREATE TABLE customers (
    id           BIGSERIAL PRIMARY KEY,
    full_name    VARCHAR(200) NOT NULL,
    phone        VARCHAR(20)  UNIQUE NOT NULL,
    -- nomor WA aktif — primary identifier untuk notifikasi + login
    address      TEXT,
    area         VARCHAR(100),   -- RT/RW atau nama wilayah
    notes        TEXT,
    status       VARCHAR(30) NOT NULL DEFAULT 'aktif',
    -- 'prospek' | 'aktif' | 'nonaktif'
    portal_password_hash VARCHAR(255),
    -- bcrypt hash, null = login via OTP WA saja
    created_by   BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW(),
    deleted_at   TIMESTAMPTZ
);
CREATE INDEX idx_customers_phone  ON customers (phone) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_status ON customers (status) WHERE deleted_at IS NULL;
```

---

**`customer_registrations`**
```sql
CREATE TABLE customer_registrations (
    id                    BIGSERIAL PRIMARY KEY,
    full_name             VARCHAR(200) NOT NULL,
    phone                 VARCHAR(20)  NOT NULL,
    address               TEXT NOT NULL,
    area                  VARCHAR(100),
    notes                 TEXT,
    bandwidth_profile_id  BIGINT REFERENCES bandwidth_profiles(id) ON DELETE SET NULL,
    router_id             BIGINT REFERENCES mikrotik_devices(id)   ON DELETE SET NULL,
    status                VARCHAR(30) NOT NULL DEFAULT 'pending',
    -- 'pending' | 'approved' | 'rejected' | 'cancelled'
    rejection_reason      TEXT,
    reviewed_by           BIGINT REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at           TIMESTAMPTZ,
    assigned_to           BIGINT REFERENCES users(id) ON DELETE SET NULL,
    -- operator yang ditugaskan untuk instalasi
    scheduled_at          TIMESTAMPTZ,
    installed_at          TIMESTAMPTZ,
    customer_id           BIGINT REFERENCES customers(id) ON DELETE SET NULL,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_registrations_status ON customer_registrations (status);
```

---

### 4.4 Paket & Subscription

**`bandwidth_profiles`**
```sql
CREATE TABLE bandwidth_profiles (
    id                    BIGSERIAL PRIMARY KEY,
    router_id             BIGINT REFERENCES mikrotik_devices(id) ON DELETE CASCADE,
    name                  VARCHAR(100) NOT NULL,
    mikrotik_profile_name VARCHAR(100) NOT NULL,
    -- nama profil di MikroTik — join key ke router
    rate_limit            VARCHAR(50),  -- "10M/10M"
    price_monthly         BIGINT NOT NULL DEFAULT 0,
    description           TEXT,
    active                BOOLEAN NOT NULL DEFAULT TRUE,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW(),
    deleted_at            TIMESTAMPTZ,
    UNIQUE (router_id, mikrotik_profile_name)
);
```

---

**`subscriptions`**
```sql
CREATE TABLE subscriptions (
    id                    BIGSERIAL PRIMARY KEY,
    customer_id           BIGINT REFERENCES customers(id)           ON DELETE RESTRICT,
    router_id             BIGINT REFERENCES mikrotik_devices(id)    ON DELETE RESTRICT,
    bandwidth_profile_id  BIGINT REFERENCES bandwidth_profiles(id)  ON DELETE RESTRICT,
    pppoe_username        VARCHAR(100) UNIQUE NOT NULL,
    pppoe_password        TEXT NOT NULL,
    -- dienkripsi via store/crypto.go (AES-256-GCM)
    status                VARCHAR(30) NOT NULL DEFAULT 'pending_install',
    -- 'pending_install' | 'active' | 'isolir' | 'suspended' | 'terminated'
    billing_day           SMALLINT,
    -- tanggal tagih 1-28, null = ambil dari system_settings
    activated_at          TIMESTAMPTZ,
    next_invoice_date     DATE,
    terminated_at         TIMESTAMPTZ,
    mikrotik_sync_status  VARCHAR(30) NOT NULL DEFAULT 'synced',
    -- 'synced' | 'pending_create' | 'pending_enable' | 'pending_disable'
    -- | 'pending_profile_change' | 'pending_delete' | 'error'
    mikrotik_sync_notes   TEXT,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW(),
    deleted_at            TIMESTAMPTZ
);
CREATE INDEX idx_subscriptions_customer ON subscriptions (customer_id);
CREATE INDEX idx_subscriptions_status   ON subscriptions (status) WHERE deleted_at IS NULL;
CREATE INDEX idx_subscriptions_sync     ON subscriptions (mikrotik_sync_status)
    WHERE mikrotik_sync_status != 'synced';
CREATE INDEX idx_subscriptions_billing  ON subscriptions (next_invoice_date)
    WHERE status = 'active';
```

---

### 4.5 Billing

**`invoices`**
```sql
CREATE TABLE invoices (
    id             BIGSERIAL PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,  -- INV-2025-06-0001
    customer_id    BIGINT REFERENCES customers(id)     ON DELETE RESTRICT,
    subscription_id BIGINT REFERENCES subscriptions(id) ON DELETE RESTRICT,
    amount         BIGINT NOT NULL,
    period_start   DATE NOT NULL,
    period_end     DATE NOT NULL,
    due_date       DATE NOT NULL,
    status         VARCHAR(20) NOT NULL DEFAULT 'draft',
    -- 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled'
    issued_at      TIMESTAMPTZ,
    paid_at        TIMESTAMPTZ,
    notes          TEXT,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (subscription_id, period_start)
    -- guard idempotency generate invoice
);
CREATE INDEX idx_invoices_customer ON invoices (customer_id);
CREATE INDEX idx_invoices_status   ON invoices (status);
CREATE INDEX idx_invoices_due      ON invoices (due_date) WHERE status IN ('issued','overdue');
```

---

**`invoice_items`**
```sql
CREATE TABLE invoice_items (
    id          BIGSERIAL PRIMARY KEY,
    invoice_id  BIGINT REFERENCES invoices(id) ON DELETE CASCADE,
    description VARCHAR(255) NOT NULL,
    quantity    SMALLINT NOT NULL DEFAULT 1,
    unit_price  BIGINT NOT NULL,
    amount      BIGINT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

---

**`payments`**
```sql
CREATE TABLE payments (
    id               BIGSERIAL PRIMARY KEY,
    invoice_id       BIGINT REFERENCES invoices(id)   ON DELETE RESTRICT,
    customer_id      BIGINT REFERENCES customers(id)  ON DELETE RESTRICT,
    amount           BIGINT NOT NULL,
    method           VARCHAR(30) NOT NULL,
    -- 'manual_transfer' | 'cash' | 'xendit' | 'midtrans'
    reference_number VARCHAR(100),
    proof_url        TEXT,
    bank_name        VARCHAR(100),
    external_ref     VARCHAR(200),
    gateway_response JSONB,
    status           VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- 'pending' | 'confirmed' | 'rejected'
    confirmed_by     BIGINT REFERENCES users(id) ON DELETE SET NULL,
    confirmed_at     TIMESTAMPTZ,
    rejection_reason TEXT,
    idempotency_key  VARCHAR(200) UNIQUE,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_payments_invoice ON payments (invoice_id);
CREATE INDEX idx_payments_status  ON payments (status);
```

---

### 4.6 Notifikasi

**`notification_logs`**
```sql
CREATE TABLE notification_logs (
    id               BIGSERIAL PRIMARY KEY,
    customer_id      BIGINT REFERENCES customers(id) ON DELETE SET NULL,
    template_slug    VARCHAR(100) NOT NULL,
    recipient_phone  VARCHAR(20)  NOT NULL,
    message_body     TEXT NOT NULL,
    status           VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- 'pending' | 'sent' | 'failed' | 'skipped'
    provider         VARCHAR(50),
    provider_response JSONB,
    retry_count      SMALLINT NOT NULL DEFAULT 0,
    sent_at          TIMESTAMPTZ,
    next_retry_at    TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notif_pending ON notification_logs (status, next_retry_at)
    WHERE status IN ('pending', 'failed');
```

---

## 5. Route Structure

```
# ZONE 1: Public — tanpa auth
POST /api/public/registrations                     → submit form daftar
POST /api/public/customer/auth/otp/request         → minta OTP via WA
POST /api/public/customer/auth/otp/verify          → verifikasi OTP → customer JWT

# ZONE 2: Staff — staff JWT (admin/operator/viewer)
# Auth endpoints (sudah ada)
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/auth/me

# User management — admin only (sudah ada)
GET/POST/PUT/DELETE /api/v1/auth/users

# Device management — sudah ada, tidak berubah
GET/POST/PUT/DELETE /api/v1/devices
GET/... /api/v1/devices/:id/...

# System settings — admin only
GET  /api/v1/settings
PUT  /api/v1/settings/:key
GET/PUT /api/v1/message-templates/:slug

# Customer management — admin + operator
GET/POST        /api/v1/customers
GET/PUT/DELETE  /api/v1/customers/:id

# Registration flow — admin + operator
GET  /api/v1/registrations
GET  /api/v1/registrations/:id
POST /api/v1/registrations/:id/approve
POST /api/v1/registrations/:id/reject
PUT  /api/v1/registrations/:id/assign
POST /api/v1/registrations/:id/complete-install   → operator only

# Bandwidth profiles (paket PPPoE) — admin + operator
GET/POST/PUT/DELETE /api/v1/bandwidth-profiles

# Subscriptions — admin + operator
GET  /api/v1/subscriptions
GET  /api/v1/subscriptions/:id
POST /api/v1/subscriptions/:id/isolir
POST /api/v1/subscriptions/:id/restore
POST /api/v1/subscriptions/:id/suspend
POST /api/v1/subscriptions/:id/terminate
PUT  /api/v1/subscriptions/:id/change-package

# Billing — admin only (kecuali GET untuk operator)
GET       /api/v1/invoices
GET       /api/v1/invoices/:id
POST      /api/v1/invoices/:id/cancel             → admin only
GET       /api/v1/payments
GET       /api/v1/payments/:id
POST      /api/v1/payments/:id/confirm            → admin only
POST      /api/v1/payments/:id/reject             → admin only

# ZONE 3: Customer portal — customer JWT
GET  /api/customer/me
PUT  /api/customer/me
PUT  /api/customer/me/password
GET  /api/customer/subscription
GET  /api/customer/subscription/status            → live MikroTik query
GET  /api/customer/invoices
GET  /api/customer/invoices/:id
POST /api/customer/invoices/:id/pay               → upload bukti transfer
GET  /api/customer/payments
```

---

## 6. Alur Bisnis Utama

### 6.1 Registrasi → Aktivasi

```
[Landing Page]
  POST /api/public/registrations
  → DB: CustomerRegistration { status: pending }
  → Notif WA ke admin (template: registration_received)

[Admin Portal — approve]
  POST /api/v1/registrations/:id/approve
  → DB: Customer { status: aktif }
  → DB: CustomerRegistration { status: approved, customer_id }
  → DB: assign ke operator
  → Notif WA ke calon customer (template: registration_approved, isi jadwal pasang)

[Admin Portal — reject]
  POST /api/v1/registrations/:id/reject
  → DB: CustomerRegistration { status: rejected, rejection_reason }
  → Notif WA ke calon customer (template: registration_rejected)

[Operator — complete install]
  POST /api/v1/registrations/:id/complete-install
  → MikroTik: /ppp/secret/add { name, password, profile, service=pppoe }
  → DB: Subscription { status: active, activated_at: now }
  → DB: CustomerRegistration { installed_at: now }
  → DB: Invoice pertama digenerate (draft → issued)
  → Notif WA ke customer (template: installation_complete, isi username + password)
```

---

### 6.2 Billing Cycle (Anniversary)

```
[Setiap hari 07:00 — billing_cron.go]

1. Query: subscriptions WHERE status='active'
          AND next_invoice_date = TODAY

2. Untuk setiap subscription:
   billing_day = subscription.billing_day ?? system_settings['billing.default_billing_day']

3. Generate Invoice:
   period_start = next_invoice_date
   period_end   = next_invoice_date + 1 bulan - 1 hari
   due_date     = next_invoice_date + system_settings['billing.invoice_due_days']
   status       = 'issued'

4. Generate InvoiceItem:
   description  = "Langganan {profile_name} {period}"
   unit_price   = bandwidth_profile.price_monthly

5. Update subscription.next_invoice_date += 1 bulan

6. Notif WA ke customer (template: invoice_issued)
```

**Guard idempotency:** `UNIQUE (subscription_id, period_start)` — aman
dijalankan ulang tanpa duplicate invoice.

---

### 6.3 Overdue & Suspension

```
[Setiap hari 09:00 — suspension_check.go]

STEP 1: Reminder (H-2 sebelum due_date)
  → Notif WA (template: invoice_reminder)

STEP 2: Mark overdue
  Invoice WHERE due_date < TODAY AND status='issued'
  → DB: invoice.status = 'overdue'
  → Notif WA (template: invoice_overdue)

STEP 3: Isolir (due_date + isolir_after_days hari)
  Ambil: billing.isolir_after_days, billing.isolir_profile_name
  → DB: subscription.status = 'isolir'
  → DB: subscription.mikrotik_sync_status = 'pending_profile_change'
  → Notif WA (template: service_isolir)
  [Outbox goroutine]
  → MikroTik: /ppp/secret/set profile=<isolir_profile>
  → DB: sync_status = 'synced'

STEP 4: Hard suspend (due_date + hard_suspend_after_days hari)
  → DB: subscription.status = 'suspended'
  → DB: subscription.mikrotik_sync_status = 'pending_disable'
  → Notif WA (template: service_suspended)
  [Outbox goroutine]
  → MikroTik: /ppp/secret/disable
  → DB: sync_status = 'synced'
```

**Dua strategi suspend:**
- **Isolir** = ganti profil ke kecepatan rendah. Customer masih bisa connect,
  masih bisa akses customer portal untuk bayar. Nama profil dari
  `system_settings['billing.isolir_profile_name']`.
- **Suspend keras** = disable PPPoE secret. Customer tidak bisa connect sama sekali.

---

### 6.4 Pembayaran Manual

```
[Customer Portal]
  POST /api/customer/invoices/:id/pay
  → DB: Payment { status: pending, method, reference_number, proof_url }
  → Notif WA ke admin: ada pembayaran menunggu konfirmasi

[Admin Portal]
  POST /api/v1/payments/:id/confirm
  → DB: Payment { status: confirmed }
  → DB: Invoice { status: paid }
  → Cek status subscription:
    'isolir' → sync_status = 'pending_profile_change' (kembalikan ke profil normal)
    'suspended' → sync_status = 'pending_enable'
  → [Outbox] eksekusi ke MikroTik
  → DB: subscription.status = 'active'
  → Notif WA ke customer (template: payment_confirmed)

  POST /api/v1/payments/:id/reject
  → DB: Payment { status: rejected }
  → Notif WA ke customer (template: payment_rejected)
```

---

### 6.5 Customer Portal Login (WA OTP)

```
POST /api/public/customer/auth/otp/request { phone }
→ Cek customer exist dengan phone ini
→ Generate OTP 6 digit, simpan Redis/DB TTL 5 menit
→ Kirim via go-wa: "Kode OTP: 123456 (5 menit)"

POST /api/public/customer/auth/otp/verify { phone, otp }
→ Validasi OTP
→ Signer.SignCustomerAccess(customerID, phone)
→ Return access_token (15m) + refresh_token (7d, httpOnly cookie)
```

---

## 7. Outbox Pattern

```
Setiap mutasi subscription yang butuh MikroTik:
  1. UPDATE subscriptions SET mikrotik_sync_status='pending_*' (dalam satu DB tx)
  2. Return HTTP 200 (tidak tunggu MikroTik)

Background outbox goroutine (tiap 10 detik):
  SELECT * FROM subscriptions
  WHERE mikrotik_sync_status != 'synced'
  FOR UPDATE SKIP LOCKED        ← cegah double-process
  LIMIT 20

  Untuk setiap row:
    Execute MikroTik command sesuai pending_*
    OK  → sync_status = 'synced', sync_notes = ''
    ERR → catat di sync_notes, retry di iterasi berikutnya
    ERR > 5x → notif admin + status = 'error'
```

---

## 8. Background Jobs

```go
// job/billing_cron.go  — Run() dipanggil scheduler jam 07:00 harian
// job/suspension_check.go — Run() dipanggil jam 09:00 harian
// job/reconciler.go    — Run() dipanggil tiap jam (sync drift check)
// job/notif_retry.go   — Run() dipanggil tiap 5 menit (retry WA gagal)
```

Semua job punya signature `Run(ctx context.Context) error` dan harus
idempotent. Wire di `cmd/server/main.go` dengan scheduler ringan
(`github.com/robfig/cron/v3` atau `github.com/go-co-op/gocron/v2`).

---

## 9. Notification Service

```go
// service/notification/
type Sender interface {
    Send(ctx context.Context, phone, message string) error
}

// GoWASender → self-hosted go-wa HTTP API
type GoWASender struct { apiURL, sender string }

type Service struct {
    sender    Sender
    templates TemplateStore
    logs      NotifLogStore
}

// Notify render template → send → log. Async-safe: write log dulu,
// send background. Gagal kirim = log status='failed', retry oleh notif_retry job.
func (s *Service) Notify(ctx, customerID, templateSlug string, vars map[string]string) error
func (s *Service) NotifyAsync(customerID uint, templateSlug string, vars map[string]string)
```

Template rendering pakai `text/template` stdlib. Variabel format `{{.FieldName}}`.

---

## 10. Urutan Implementasi

```
FASE 1 — Foundation (selesaikan prerequisites dulu)
  Dockerfile + docker-compose.full.yml
  Customer JWT scope (CustomerClaims + RequireCustomerAuth)
  Extend store/migrate.go

FASE 2 — Core Business Data
  system_settings + message_templates + sequence_counters (models + stores + API)
  bandwidth_profiles (models + stores + CRUD API)
  customers (models + stores + CRUD API)
  notification service (go-wa adapter + template render + retry log)

FASE 3 — Registration & Subscription
  customer_registrations (models + stores + flow API)
  subscriptions (models + stores + lifecycle API)
  PPPoE workflows (activate, isolir, terminate)
  outbox syncer goroutine

FASE 4 — Billing
  invoices + invoice_items (generate + CRUD API)
  payments (manual confirm API)
  billing_cron job
  suspension_check job
  audit_logs (catat semua aksi billing)

FASE 5 — Customer Portal
  Customer auth (OTP WA → CustomerJWT)
  Portal endpoints (/api/customer/*)
  Payment submission (upload bukti)

FASE 6 — Hardening & Ops
  reconciler job (drift detection)
  notif_retry job
  Migration tool legacy /system/script
  Payment gateway (Xendit) — opsional
```
