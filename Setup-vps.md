# Database Management, Dashboard, & Rosmon Setup Guide (VPS)

Berikut adalah panduan lengkap mengenai database stack baru Anda di VPS (`203.145.34.217`), serta petunjuk bagaimana aplikasi **rosmon** telah diintegrasikan dengan database tersebut.

Semua container berada dalam satu Docker network internal `db-tools_default` dan port-port penting juga telah dibuka di firewall VPS (`ufw`).

---

## 🌐 Akses Web UI & Kredensial

### 1. pgAdmin 4 (PostgreSQL Web UI)
* **URL:** [http://203.145.34.217:5050](http://203.145.34.217:5050)
* **Kredensial Login:**
  * **Email:** `admin@ghaibnet.co.id`
  * **Password:** `JituPasswordAdmin123!`

### 2. Grafana Dashboard (Visualisasi & Monitoring)
* **URL:** [http://203.145.34.217:3001](http://203.145.34.217:3001)
  * *(Port `3001` digunakan karena port `3000` sedang dipakai oleh gateway WhatsApp).*
* **Kredensial Login:**
  * **Username:** `admin`
  * **Password:** `JituPasswordGrafana123!`

---

## 🔑 Kredensial Database & Token

### 🐘 PostgreSQL 17 (Database)
* **Host Publik:** `203.145.34.217`
* **Port Publik:** `5432`
* **Username:** `postgres`
* **Password:** `JituPasswordPostgres123!`
* **Database Default:** `postgres`
* **Database untuk Rosmon:** `mikhmon` *(Telah dibuat secara otomatis)*

### 📊 InfluxDB 3 (Database Time-Series)
* **Host Publik:** `203.145.34.217`
* **Port Publik:** `8181`
* **Status Auth:** **Aktif (Dengan Token)**
* **Database untuk Rosmon:** `mikhmon` *(Telah dibuat secara otomatis)*
* **Admin Token:**
  ```text
  apiv3_DYEDNDoSz2X9YPCt5IpB0v70n5giIQ4ZQmzW7ttaYSZXw4s8KjnO848p4bzrCaZymB44ShbtLPUD0lhWASRSGA
  ```
  *(Simpan token ini dengan aman untuk kebutuhan coding/API integration)*

---

## 🚀 Integrasi Aplikasi Rosmon

Aplikasi **rosmon** telah dikonfigurasi untuk terhubung langsung ke stack database utama ini (bukan database lokal khusus rosmon).

### Konfigurasi Jaringan & Port
* **rosmon-backend** terhubung melalui network docker `db-tools_default` dan diarahkan ke:
  * **PostgreSQL:** Host `postgres-db` (Port `5432`)
  * **InfluxDB 3:** Host `influxdb-db` (Port `8181`)
* Port yang diexpose pada VPS:
  * **rosmon-frontend:** Diarahkan ke `127.0.0.1:8081` (diakses publik secara aman via Nginx reverse proxy port 80/443 di domain `rosmon.ghaibnet.co.id`).
  * **rosmon-backend:** Diarahkan ke `127.0.0.1:8088` (diakses secara aman via reverse proxy `/api/` dan `/hook/`).

### Konfigurasi `.env` Rosmon
File `/home/jitu/rosmon/.env` telah disesuaikan dengan nilai database utama:
```ini
DB_HOST=postgres-db
DB_PORT=5432
DB_NAME=mikhmon
DB_USER=postgres
DB_PASSWORD=JituPasswordPostgres123!

INFLUX_ENABLED=true
INFLUX_HOST=http://influxdb-db:8181
INFLUX_TOKEN=apiv3_DYEDNDoSz2X9YPCt5IpB0v70n5giIQ4ZQmzW7ttaYSZXw4s8KjnO848p4bzrCaZymB44ShbtLPUD0lhWASRSGA
INFLUX_DATABASE=mikhmon
```

---

## 🛠️ Manajemen Docker Service di VPS

### A. Untuk Database & UI Tools (`/home/jitu/db-tools`)
* **Melihat Status Container:**
  ```bash
  docker compose -f /home/jitu/db-tools/docker-compose.yml ps
  ```
* **Menyalakan Ulang:**
  ```bash
  docker compose -f /home/jitu/db-tools/docker-compose.yml up -d
  ```

### B. Untuk Aplikasi Rosmon (`/home/jitu/rosmon`)
* **Melihat Status Container:**
  ```bash
  docker compose -f /home/jitu/rosmon/docker/docker-compose.yml -f /home/jitu/rosmon/docker/docker-compose.vps.yml ps
  ```
* **Menyalakan Ulang:**
  ```bash
  cd /home/jitu/rosmon && docker compose -f docker/docker-compose.yml -f docker/docker-compose.vps.yml up -d
  ```
* **Melihat Log Backend:**
  ```bash
  docker logs -f rosmon-backend
  ```