# Simulasi Jaringan MikroTik — Linux / Fedora

Setup ini menjalankan MikroTik RouterOS di **GNOME Boxes** (KVM/libvirt) dan
menghubungkan container Docker ke jaringan virtual yang sama menggunakan
driver **macvlan**, sehingga PPPoE maupun Hotspot bisa diuji secara nyata.

---

## Arsitektur

```text
┌──────────────────────────────────────────────────────────────────┐
│  RouterOS VM (GNOME Boxes / KVM)                                 │
│                                                                  │
│  ether1 ── default libvirt NAT ── internet / manajemen          │
│  ether2 ── virbr-hs  ──────────── 192.168.123.1  ← Hotspot LAN │
│  ether3 ── virbr-pppoe ─────────── 192.168.111.1  ← PPPoE server│
└────────────────────────┬──────────────┬─────────────────────────┘
                         │              │
              macvlan (L2)              macvlan (L2)
                         │              │
          ┌───────────────┘              └──────────────────┐
          │  hotspot-client1                 pppoe-client1   │
          │  192.168.123.200                192.168.111.200  │
          │  + mgmt-net bridge              eth0 = L2 pppoe  │
          │         ▲                                       │
          │         │ mgmt-net                              │
          │  hotspot-proxy                                  │
          │  (port 5800 → host)                             │
          └──────────────────────────────────────────────────┘
```

Karena Docker Engine di Linux berjalan **langsung di host** (bukan di dalam VM
seperti Docker Desktop), macvlan bisa dipasang di atas bridge libvirt
(`virbr-hs`, `virbr-pppoe`). Container langsung terlihat di L2 yang sama
dengan interface MikroTik — PPPoE discovery frame bisa sampai ke PPPoE server.

---

## Prasyarat

```bash
# Fedora
sudo dnf install -y libvirt virt-manager qemu-kvm docker-ce docker-ce-cli

sudo systemctl enable --now libvirtd
sudo systemctl enable --now docker

# Tambahkan user ke grup (logout + login kembali setelahnya)
sudo usermod -aG libvirt,docker $USER
```

> GNOME Boxes biasanya sudah terinstall di Fedora Workstation. Jika belum:
> `sudo dnf install -y gnome-boxes`

---

## Langkah 1 — Buat Jaringan Libvirt

Dua virtual network perlu dibuat: satu untuk hotspot, satu untuk PPPoE.
File XML sudah tersedia di direktori `network/`.

```bash
cd docker/mikrotik

# Definisikan dan aktifkan network
sudo virsh net-define  network/mikrotik-hotspot.xml
sudo virsh net-start   mikrotik-hotspot
sudo virsh net-autostart mikrotik-hotspot

sudo virsh net-define  network/mikrotik-pppoe.xml
sudo virsh net-start   mikrotik-pppoe
sudo virsh net-autostart mikrotik-pppoe

# Verifikasi bridge sudah ada
ip link show virbr-hs
ip link show virbr-pppoe
```

Output yang diharapkan dari `ip link show virbr-hs`:

```text
6: virbr-hs: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 ...
    inet 192.168.123.254/24 ...
```

> **Catatan:** `virsh net-list --all` mungkin menampilkan daftar kosong jika
> kamu menggunakan GNOME Boxes (qemu:///session). Ini normal — bridge sudah
> ada di kernel, hanya saja tidak terdaftar di session virsh. Yang penting
> bridge `virbr-hs` dan `virbr-pppoe` muncul di `ip link show`.

---

## Langkah 2 — Download MikroTik CHR

MikroTik **Cloud Hosted Router (CHR)** adalah image qcow2 yang berjalan
di KVM/QEMU dan cocok untuk GNOME Boxes.

1. Buka <https://mikrotik.com/download> → pilih **Cloud Hosted Router**
2. Download format **Raw disk image** (`.img`) atau ISO installer
3. Konversi ke qcow2 jika perlu:

```bash
qemu-img convert -f raw chr-7.x.x.img -O qcow2 chr-7.x.x.qcow2
```

---

## Langkah 3 — Import MikroTik ke GNOME Boxes

1. Buka **GNOME Boxes** → klik tombol **+** → pilih **Import a file**
2. Pilih file `chr-7.x.x.qcow2` (atau installer ISO)
3. Beri nama VM: `MikroTik`
4. Alokasikan RAM minimal **128 MB**
5. Klik **Create** dan jalankan VM sampai RouterOS boot
6. Login default RouterOS: `admin` / *(kosong — Enter saja)*

---

## Langkah 4 — Izinkan Bridge di QEMU

QEMU membutuhkan izin eksplisit untuk menggunakan bridge sebagai interface VM.
Tambahkan bridge libvirt ke file konfigurasi QEMU:

```bash
echo "allow virbr-hs"    | sudo tee -a /etc/qemu/bridge.conf
echo "allow virbr-pppoe" | sudo tee -a /etc/qemu/bridge.conf

# Verifikasi isi file
cat /etc/qemu/bridge.conf
# Output yang diharapkan:
# allow virbr0
# allow virbr-hs
# allow virbr-pppoe
```

---

## Langkah 5 — Load Kernel Module macvlan

Modul macvlan diperlukan Docker untuk membuat macvlan network. Di Fedora,
modul ini tidak otomatis ter-load.

```bash
sudo modprobe macvlan

# Verifikasi
lsmod | grep macvlan
# Output: macvlan   40960  0
```

Agar otomatis load saat boot:

```bash
echo "macvlan" | sudo tee /etc/modules-load.d/macvlan.conf
```

---

## Langkah 6 — Tambah Interface ke VM MikroTik

GNOME Boxes hanya membuat NIC pertama (ether1 = user-mode NAT). Tambahkan
ether2 dan ether3 via `virsh`. VM harus dimatikan terlebih dahulu.

```bash
# Cek nama domain VM
virsh list --all

# Matikan VM
virsh shutdown MikroTik   # atau nama sesuai output virsh list

# Tambah ether2 → hotspot LAN (gunakan --type bridge, bukan --type network)
virsh attach-interface MikroTik \
  --type bridge \
  --source virbr-hs \
  --model virtio \
  --config

# Tambah ether3 → PPPoE server
virsh attach-interface MikroTik \
  --type bridge \
  --source virbr-pppoe \
  --model virtio \
  --config

# Verifikasi (harus ada 3 interface)
virsh domiflist MikroTik
```

Output yang diharapkan:

```text
 Interface   Type     Source        Model     MAC
-----------------------------------------------------------------
 -           user     -             rtl8139   52:54:00:xx:xx:xx
 -           bridge   virbr-hs      virtio    52:54:00:xx:xx:xx
 -           bridge   virbr-pppoe   virtio    52:54:00:xx:xx:xx
```

Nyalakan VM kembali:

```bash
virsh start MikroTik
```

> **Penting:** Gunakan `--type bridge` dan `--source virbr-hs`, **bukan**
> `--type network`. Jika menggunakan `--type network`, VM gagal start karena
> user-session virsh tidak mengenal network "mikrotik-hotspot" meskipun
> bridge-nya sudah ada di kernel.

---

## Langkah 7 — Konfigurasi RouterOS

Buka console RouterOS di GNOME Boxes. Login: `admin` + password Anda
(default kosong, tekan Enter saja).

### 7.1 Cek Interface

```routeros
/interface print
```

Pastikan ada ether1, ether2, ether3. Jika nama interface berbeda, sesuaikan
perintah di bawah.

### 7.2 IP Address

```routeros
/ip address add address=192.168.123.1/24 interface=ether2
/ip address add address=192.168.111.1/24 interface=ether3
```

### 7.3 PPPoE Pool & Profile

```routeros
/ip pool add name=pppoe-pool ranges=192.168.111.2-192.168.111.100

/ppp profile add \
  name=pppoe-profile \
  local-address=192.168.111.1 \
  remote-address=pppoe-pool \
  dns-server=8.8.8.8
```

### 7.4 User PPPoE

```routeros
/ppp secret add name=test password=1122 service=pppoe profile=pppoe-profile
```

### 7.5 PPPoE Server

```routeros
/interface pppoe-server server add \
  interface=ether3 \
  service-name=pppoe \
  default-profile=pppoe-profile \
  disabled=no
```

### 7.6 Hotspot

```routeros
# Pool IP untuk client hotspot
/ip pool add name=hs-pool ranges=192.168.123.10-192.168.123.150

# DHCP untuk hotspot LAN
/ip dhcp-server add \
  interface=ether2 \
  address-pool=hs-pool \
  name=hotspot-dhcp \
  disabled=no

/ip dhcp-server network add \
  address=192.168.123.0/24 \
  gateway=192.168.123.1 \
  dns-server=8.8.8.8

# Setup Hotspot via wizard
/ip hotspot setup
# Wizard prompts:
#   hotspot interface:          ether2
#   local address:              (Enter — pakai 192.168.123.1/24)
#   masquerade network:         (Enter — yes)
#   address pool:               (Enter — pakai hs-pool)
#   select certificate:         none
#   ip address of smtp server:  (Enter — 0.0.0.0)
#   dns servers:                (Enter — 8.8.8.8)
#   dns name:                   (Enter — kosong)
#   name of local hotspot user: (Enter — admin)
#   password for the user:      (Enter — kosong)
```

### 7.7 NAT Masquerade (wajib agar container bisa install packages)

```routeros
/ip firewall nat add chain=srcnat action=masquerade out-interface=ether1
```

### 7.8 Verifikasi

```routeros
/ip address print
/interface pppoe-server server print
/ip hotspot print
/ppp secret print
/ip firewall nat print
```

---

## Langkah 8 — Menjalankan Container

### Prasyarat penting: Docker system daemon (bukan Podman)

Di Fedora, perintah `docker` default diarahkan ke **Podman** via `DOCKER_HOST`.
Podman rootless **tidak bisa** membuat macvlan interface di atas bridge libvirt
— akibatnya semua container PPPoE/Hotspot gagal start dengan error
`netavark: No such device`.

Gunakan Docker Engine (system daemon) yang berjalan sebagai root:

```bash
# Cek: apakah ini Podman atau Docker?
docker version | grep "Server:"
# → "Podman Engine" = Podman (harus ganti)
# → "Docker Engine" = Docker (aman)

# Solusi: selalu tambahkan DOCKER_HOST saat menjalankan perintah docker/compose
export DOCKER_HOST=unix:///run/docker.sock
```

> **Tip:** Tambahkan `alias dk='DOCKER_HOST=unix:///run/docker.sock docker'`
> ke `~/.bashrc` agar tidak perlu mengetik panjang setiap saat.

---

### Menjalankan semua container

```bash
cd docker/mikrotik

# Pastikan seed data sudah ada di MikroTik (jalankan sekali dari root repo)
go run ./cmd/seed/

# Start semua container (5 PPPoE + 1 Hotspot Firefox)
DOCKER_HOST=unix:///run/docker.sock docker compose up -d
```

Output yang diharapkan:

```text
 ✔ Network mikrotik_mgmt-net    Created
 ✔ Network mikrotik_hotspot-net Created
 ✔ Network mikrotik_pppoe-net   Created
 ✔ Container pppoe-client1      Started
 ✔ Container pppoe-client2      Started
 ✔ Container pppoe-client3      Started
 ✔ Container pppoe-client4      Started
 ✔ Container pppoe-client5      Started
 ✔ Container hotspot-client1    Started
```

### Daftar container

| Container | User PPPoE | Password | Profil | IP Statik (eth0) |
|---|---|---|---|---|
| `pppoe-client1` | pppoe-user1 | Pppoe@1122 | paket-bronze | 192.168.111.200 |
| `pppoe-client2` | pppoe-user2 | Pppoe@2233 | paket-silver | 192.168.111.201 |
| `pppoe-client3` | pppoe-user3 | Pppoe@3344 | paket-gold   | 192.168.111.202 |
| `pppoe-client4` | pppoe-user4 | Pppoe@4455 | paket-bronze | 192.168.111.203 |
| `pppoe-client5` | pppoe-user5 | Pppoe@5566 | paket-silver | 192.168.111.204 |
| `hotspot-client1` | — | — | Firefox browser | 192.168.123.200 |

Semua PPPoE client **otomatis konek** saat container start. Tidak perlu
perintah manual apapun.

---

## Langkah 9 — Verifikasi PPPoE

Tunggu sekitar 15–30 detik setelah `docker compose up -d` untuk proses
`apk add` dan PPPoE handshake selesai.

### Cek IP ppp0 semua container sekaligus

```bash
for i in 1 2 3 4 5; do
  printf "pppoe-client%d (%s) → " $i \
    "$(DOCKER_HOST=unix:///run/docker.sock docker exec pppoe-client$i \
       sh -c 'echo $PPPOE_USER')"
  DOCKER_HOST=unix:///run/docker.sock docker exec pppoe-client$i \
    ip addr show ppp0 2>/dev/null | grep "inet " | awk '{print $2}' \
    || echo "ppp0 belum UP"
done
```

Output yang diharapkan:

```text
pppoe-client1 (pppoe-user1) → 192.168.111.96
pppoe-client2 (pppoe-user2) → 192.168.111.92
pppoe-client3 (pppoe-user3) → 192.168.111.93
pppoe-client4 (pppoe-user4) → 192.168.111.94
pppoe-client5 (pppoe-user5) → 192.168.111.95
```

> IP yang diberikan berasal dari pool PPPoE MikroTik (`pppoe-pool`),
> bukan dari IP statik eth0 container. Nilainya bisa berbeda setiap koneksi.

### Ping via ppp0 ke MikroTik

```bash
DOCKER_HOST=unix:///run/docker.sock docker exec pppoe-client1 \
  ping -c 3 -I ppp0 192.168.111.1
```

### Verifikasi sesi aktif di MikroTik via REST API

```bash
curl -s -u admin:admin http://192.168.111.1/rest/ppp/active | \
  python3 -c "
import json, sys
for s in json.load(sys.stdin):
    print(f\"  {s['name']:<15} IP={s['address']:<18} uptime={s['uptime']}\")"
```

Output:

```text
  pppoe-user1     IP=192.168.111.96     uptime=1m47s
  pppoe-user2     IP=192.168.111.92     uptime=1m46s
  pppoe-user3     IP=192.168.111.93     uptime=1m45s
  pppoe-user4     IP=192.168.111.94     uptime=1m45s
  pppoe-user5     IP=192.168.111.95     uptime=1m45s
```

Atau di **WinBox**: `/PPP → Active Connections` — 5 sesi muncul.

### Lihat log koneksi PPPoE

```bash
# Log satu container
DOCKER_HOST=unix:///run/docker.sock docker logs -f pppoe-client1

# Cuplikan log yang menandakan sukses:
# [pppoe-client1] starting pppd: user=pppoe-user1 plugin=...pppoe.so
# CHAP authentication succeeded
# local  IP address 192.168.111.96
# remote IP address 192.168.111.1
```

---

## Langkah 10 — Verifikasi Hotspot

### Kenapa harus lewat browser?

MikroTik Hotspot menggunakan **CHAP/MD5 challenge-response** — password
di-hash di sisi browser menggunakan JavaScript sebelum dikirim ke server.
Karena itu login **tidak bisa dilakukan via `curl` atau `wget` biasa**.

Container `hotspot-client1` adalah **Firefox** yang terhubung langsung ke
jaringan hotspot MikroTik (macvlan, IP `192.168.123.200`). Browser ini yang
melakukan hash password via JS sebelum submit form.

---

### Langkah login hotspot

#### 1. Buka Firefox container

Buka browser di komputer host, arahkan ke:

```
http://localhost:5800
```

Tampil Firefox yang berjalan di dalam container. Firefox ini sudah berada
di subnet `192.168.123.x` — sama dengan subnet hotspot MikroTik.

#### 2. Navigasi ke halaman login

Di address bar Firefox, ketik:

```
http://192.168.123.1
```

MikroTik akan menampilkan halaman **"Internet hotspot — Log in"**.

> **Catatan:** Ping ICMP ke `192.168.123.1` akan **gagal** — ini normal.
> MikroTik hotspot memblok semua traffic sampai login. HTTP tetap bisa diakses.

#### 3. Login dengan salah satu user

| User | Password | Profil | Kecepatan |
|---|---|---|---|
| `hs-perm1` | `HsPerm@11` | hs-basic | 5 Mbps |
| `hs-perm2` | `HsPerm@22` | hs-kantor | 20 Mbps |
| `hs-perm3` | `HsPerm@33` | hs-basic | 5 Mbps |

Isi form login → klik **OK / Log In** → MikroTik redirect ke halaman status.

#### 4. Verifikasi sesi aktif di MikroTik

```bash
curl -s -u admin:admin http://192.168.111.1/rest/ip/hotspot/active | \
  python3 -c "
import json, sys
data = json.load(sys.stdin)
if not data:
    print('  (tidak ada sesi aktif)')
for s in data:
    print(f\"  {s['user']:<12} IP={s['address']:<18} uptime={s['uptime']}\")"
```

Output saat berhasil login:

```text
  hs-perm1     IP=192.168.123.xxx   uptime=30s
```

Atau di **WinBox**: `/IP → Hotspot → Active` — sesi user muncul.

#### 5. Logout dan ganti user

Untuk test user berikutnya, logout dulu:

```
http://192.168.123.1/logout
```

MikroTik akan menampilkan halaman konfirmasi logout. Setelah logout,
halaman login muncul kembali — langsung login dengan user lain.

---

### Verifikasi koneksi L2 hotspot (tanpa login)

```bash
# ARP ping ke gateway — harus reply meski belum login
DOCKER_HOST=unix:///run/docker.sock docker exec hotspot-client1 \
  arping -c 3 -I eth1 192.168.123.1

# Cek HTML halaman login
DOCKER_HOST=unix:///run/docker.sock docker exec hotspot-client1 \
  wget -q -O - http://192.168.123.1 2>/dev/null | grep "<title>"
# Output: <title>Internet hotspot - Log in</title>
```



## Menghentikan Container

```bash
# Stop semua (container tetap ada, bisa di-start lagi)
DOCKER_HOST=unix:///run/docker.sock docker compose stop

# Stop + hapus container dan network
DOCKER_HOST=unix:///run/docker.sock docker compose down

# Start ulang setelah down
DOCKER_HOST=unix:///run/docker.sock docker compose up -d
```

---

## Troubleshooting

### ❌ `netavark: Netlink error: No such device (os error 19)`

**Penyebab:** `DOCKER_HOST` masih menunjuk ke Podman socket.

```bash
echo $DOCKER_HOST
# Jika: unix:///run/user/1000/podman/podman.sock → ini Podman

# Solusi: gunakan Docker system daemon
DOCKER_HOST=unix:///run/docker.sock docker compose up -d
```

---

### ❌ `macvlan: unknown parent interface` saat `docker compose up`

Bridge libvirt belum aktif. Jalankan:

```bash
# Cek bridge
ip link show virbr-hs virbr-pppoe

# Jika tidak ada, start network libvirt:
sudo virsh net-start mikrotik-pppoe
sudo virsh net-start mikrotik-hotspot
```

---

### ❌ ppp0 tidak muncul setelah 60 detik

```bash
# 1. Cek apakah PPPoE server MikroTik aktif
curl -s -u admin:admin http://192.168.111.1/rest/interface/pppoe-server/server

# 2. Test discovery dari container
DOCKER_HOST=unix:///run/docker.sock docker exec pppoe-client1 \
  timeout 5 pppoe-discovery -I eth0
# Harus muncul: Access-Concentrator: MikroTik

# 3. Cek log pppd
DOCKER_HOST=unix:///run/docker.sock docker logs pppoe-client1 | tail -20

# 4. Pastikan NAT aktif di MikroTik (agar apk add bisa download)
#    Di console RouterOS:
#    /ip firewall nat print
#    Harus ada rule: chain=srcnat action=masquerade out-interface=ether1
```

---

### ❌ `docker compose up` gagal karena network sudah ada

```bash
DOCKER_HOST=unix:///run/docker.sock docker compose down --remove-orphans
DOCKER_HOST=unix:///run/docker.sock docker network prune -f
DOCKER_HOST=unix:///run/docker.sock docker compose up -d
```

---

### ❌ VM MikroTik gagal start: `Network not found`

```bash
# Ganti interface VM ke tipe bridge (bukan network)
virsh detach-interface MikroTik network --mac <MAC> --config
virsh attach-interface MikroTik --type bridge --source virbr-hs --model virtio --config
virsh attach-interface MikroTik --type bridge --source virbr-pppoe --model virtio --config
virsh start MikroTik
```

---

## Struktur Direktori

```text
docker/mikrotik/
├── docker-compose.yaml   5 PPPoE client + 1 hotspot Firefox
├── .env                  Konfigurasi aktif (tidak di-commit)
├── .env.template         Template konfigurasi
├── network/
│   ├── mikrotik-hotspot.xml   Definisi libvirt network virbr-hs
│   └── mikrotik-pppoe.xml     Definisi libvirt network virbr-pppoe
└── README.md             Panduan ini
```

---

## Quick Reference

```bash
# ── Wajib: export dulu di setiap terminal session ──────────────────────────
export DOCKER_HOST=unix:///run/docker.sock

# ── Seed (sekali saja) ─────────────────────────────────────────────────────
cd /path/to/rosmon
go run ./cmd/seed/

# ── Jalankan ───────────────────────────────────────────────────────────────
cd docker/mikrotik
docker compose up -d

# ── Cek status ─────────────────────────────────────────────────────────────
docker compose ps

# ── Cek PPPoE (tunggu ~20 detik) ───────────────────────────────────────────
for i in 1 2 3 4 5; do
  printf "client%d → " $i
  docker exec pppoe-client$i ip addr show ppp0 2>/dev/null \
    | grep "inet " | awk '{print $2}' || echo "belum UP"
done

# ── Verifikasi di MikroTik ─────────────────────────────────────────────────
curl -s -u admin:admin http://192.168.111.1/rest/ppp/active | \
  python3 -c "import json,sys; [print(s['name'], s['address'], s['uptime']) for s in json.load(sys.stdin)]"

# ── Hotspot ────────────────────────────────────────────────────────────────
# Buka http://localhost:5800 → login http://192.168.123.1
# User: hs-perm1/HsPerm@11  hs-perm2/HsPerm@22  hs-perm3/HsPerm@33
# Logout: http://192.168.123.1/logout

# ── Stop ───────────────────────────────────────────────────────────────────
docker compose down
```


### Jika DOCKER_HOST menunjuk ke Podman

Fedora menggunakan Podman sebagai default container runtime. Jika `docker`
CLI di-redirect ke Podman socket, semua perintah macvlan network akan gagal
karena Podman rootless tidak bisa membuat macvlan interface.

Cek dulu:

```bash
docker version 2>&1 | grep "Server"
# Jika terlihat "Podman Engine" → DOCKER_HOST menunjuk ke Podman
echo $DOCKER_HOST
# Contoh: unix:///run/user/1000/podman/podman.sock  ← ini Podman
```

**Solusi:** Gunakan Docker daemon asli dengan `DOCKER_HOST=""` di setiap
perintah, atau unset secara permanen:

```bash
# Sementara (per session)
unset DOCKER_HOST

# Permanen (tambahkan ke ~/.bashrc atau ~/.zshrc)
echo 'unset DOCKER_HOST' >> ~/.bashrc
source ~/.bashrc
```

### Jalankan Docker Compose

```bash
cd docker/mikrotik

# Salin konfigurasi
cp .env.template .env
# Edit PPPOE_USER/PPPOE_PASS jika perlu (default: pppoe-user1 / Pppoe@1122)

# Wajib: gunakan Docker system daemon (bukan Podman)
# Podman rootless tidak bisa attach macvlan ke bridge libvirt
DOCKER_HOST=unix:///run/docker.sock docker compose up -d

# Atau set permanen di terminal session:
export DOCKER_HOST=unix:///run/docker.sock
docker compose up -d

# Verifikasi container UP
DOCKER_HOST=unix:///run/docker.sock docker compose ps
```

Output yang diharapkan:

```text
NAME              IMAGE                    STATUS
hotspot-client1   jlesage/firefox:latest   Up
hotspot-proxy     alpine:latest            Up
pppoe-client1     alpine:latest            Up
...
```

---

## Langkah 9 — Test Hotspot

### Via browser host

1. Buka browser di host Fedora: **<http://localhost:5800>**
2. Firefox dalam container muncul
3. Di address bar Firefox, ketik: **<http://192.168.123.1>**
4. Halaman login Hotspot MikroTik harus muncul

### Via command line

```bash
# Ping L2 (ARP) ke gateway hotspot
DOCKER_HOST="" docker exec hotspot-client1 arping -c 3 -I eth0 192.168.123.1

# HTTP ke captive portal
DOCKER_HOST="" docker exec hotspot-client1 wget -q -O - http://192.168.123.1 | head -5
# Output: <!doctype html> ... <title>Internet hotspot - Log in</title>
```

> Ping ICMP ke 192.168.123.1 akan **gagal (100% loss)** — ini normal!
> MikroTik Hotspot menginterep semua traffic sampai user login.
> Gunakan arping (ARP layer 2) untuk membuktikan L2 berfungsi.

---

## Langkah 10 — Test PPPoE

### Container auto-connect

`pppoe-client1` otomatis menjalankan PPPoE connection saat container start —
tidak perlu `pppoe-start` manual.

Credentials diambil dari `.env` (default: `PPPOE_USER=pppoe-user1`, `PPPOE_PASS=Pppoe@1122`).
Pastikan `go run ./cmd/seed/` sudah dijalankan agar user tersebut ada di MikroTik.

### Verifikasi koneksi

```bash
# Cek ppp0 interface (tunggu ~15 detik setelah container start)
DOCKER_HOST=unix:///run/docker.sock docker exec pppoe-client1 ip addr show ppp0

# Ping via PPPoE ke MikroTik
DOCKER_HOST=unix:///run/docker.sock docker exec pppoe-client1 \
  ping -c 3 -I ppp0 192.168.111.1

# Lihat log koneksi
DOCKER_HOST=unix:///run/docker.sock docker logs -f pppoe-client1
```

Output yang diharapkan:

```text
=== Interface ppp0 ===
ppp0: ... inet 192.168.111.x peer 192.168.111.1/32 ...

=== Ping via PPPoE ===
3 packets transmitted, 3 received, 0% packet loss

=== Internet via PPPoE ===
3 packets transmitted, 3 received, 0% packet loss
```

### Verifikasi di sisi MikroTik

Di console RouterOS:

```routeros
/ppp active print
# Output:
# NAME   SERVICE  CALLER-ID          ADDRESS          UPTIME
# test   pppoe    xx:xx:xx:xx:xx:xx  192.168.111.100  30s
```

---

## Troubleshooting

### ❌ `macvlan: unknown parent interface` saat `docker compose up`

Bridge libvirt belum aktif. Jalankan:

```bash
sudo virsh net-start mikrotik-pppoe
sudo virsh net-start mikrotik-hotspot
```

---

### ❌ `netavark (exit code 1): Netlink error: No such device (os error 19)`

**Penyebab:** Dua kemungkinan:

**A) DOCKER_HOST menunjuk ke Podman** (paling umum di Fedora):

```bash
echo $DOCKER_HOST
# Jika: unix:///run/user/1000/podman/podman.sock → ini Podman

# Solusi:
unset DOCKER_HOST
DOCKER_HOST="" docker compose up -d
```

**B) Kernel module macvlan belum di-load:**

```bash
lsmod | grep macvlan   # kosong = belum load

# Solusi:
sudo modprobe macvlan
DOCKER_HOST="" docker compose up -d
```

---

### ❌ VM MikroTik gagal start: `Network not found: no network with matching name 'mikrotik-hotspot'`

**Penyebab:** Interface VM menggunakan `--type network` (butuh libvirt network
terdaftar di session virsh), bukan `--type bridge`.

**Solusi:** Ganti interface ke tipe bridge:

```bash
# Cek interface yang ada
virsh domiflist MikroTik

# Hapus interface network-type yang bermasalah
virsh detach-interface MikroTik network --mac <MAC_ADDRESS> --config

# Ganti dengan bridge-type
virsh attach-interface MikroTik \
  --type bridge --source virbr-hs --model virtio --config
virsh attach-interface MikroTik \
  --type bridge --source virbr-pppoe --model virtio --config

virsh start MikroTik
```

---

### ❌ `virsh attach-interface` gagal dengan permission denied

**Penyebab:** `/etc/qemu/bridge.conf` tidak mengizinkan bridge yang dimaksud.

```bash
cat /etc/qemu/bridge.conf
# Harus ada:
# allow virbr-hs
# allow virbr-pppoe

# Solusi:
echo "allow virbr-hs"    | sudo tee -a /etc/qemu/bridge.conf
echo "allow virbr-pppoe" | sudo tee -a /etc/qemu/bridge.conf
```

---

### ❌ `pppoe-start: not found` di dalam container

**Penyebab:** `rp-pppoe` versi 4.x tidak lagi menyertakan script `pppoe-start`.

**Solusi:** Gunakan `pppd` langsung:

```bash
DOCKER_HOST="" docker exec pppoe-client1 \
  pppd plugin /usr/lib/pppd/2.5.2/pppoe.so eth0 \
    user test password 1122 noauth noipdefault defaultroute persist maxfail 1
```

---

### ❌ `apk add` lambat atau gagal di pppoe-client1

**Penyebab:** Container pppoe-client1 tidak punya internet karena RouterOS
belum dikonfigurasi NAT masquerade.

**Solusi:** Tambahkan NAT di RouterOS (lewat console GNOME Boxes):

```routeros
/ip firewall nat add chain=srcnat action=masquerade out-interface=ether1
```

Kemudian restart container:

```bash
DOCKER_HOST="" docker restart pppoe-client1
```

---

### ❌ PPPoE: `Timeout waiting for PADO packets`

1. Pastikan MikroTik VM berjalan dan PPPoE server aktif:

   ```routeros
   /interface pppoe-server server print
   ```

2. Verifikasi interface di VM terhubung ke bridge:

   ```bash
   virsh domiflist MikroTik
   # tap0 dan tap1 harus muncul saat VM running
   ```

3. Cek dari container apakah server terdeteksi:

   ```bash
   DOCKER_HOST="" docker exec pppoe-client1 \
     timeout 5 pppoe-discovery -I eth0
   # Harus muncul: Access-Concentrator: MikroTik
   ```

4. Pastikan nama bridge di `.env` sudah benar:

   ```bash
   ip link show type bridge | grep -E "virbr-hs|virbr-pppoe"
   ```

---

### ❌ Hotspot: tidak redirect ke login page

MikroTik hotspot intercept bekerja jika client berada di subnet hotspot.
Container `hotspot-client1` memiliki IP `192.168.123.200` (via macvlan).
Ping ICMP memang diblok — gunakan ARP atau HTTP:

```bash
# Cek ARP (L2) — harus reply
DOCKER_HOST="" docker exec hotspot-client1 arping -c 3 -I eth0 192.168.123.1

# Cek HTTP captive portal — harus tampil halaman login
DOCKER_HOST="" docker exec hotspot-client1 wget -q -O - http://192.168.123.1 | grep title
```

---

### ❌ `docker compose up` gagal karena network sudah ada / orphan container

```bash
DOCKER_HOST="" docker compose down --remove-orphans
DOCKER_HOST="" docker network prune -f
DOCKER_HOST="" docker compose up -d
```

---

## Struktur Direktori

```text
docker/mikrotik/
├── docker-compose.yaml     Definisi service dan network macvlan
├── .env                    Konfigurasi aktif (tidak di-commit)
├── .env.template           Template konfigurasi
├── network/
│   ├── mikrotik-hotspot.xml  Definisi libvirt network virbr-hs
│   └── mikrotik-pppoe.xml    Definisi libvirt network virbr-pppoe
└── README.md               Panduan ini
```

---

## Ringkasan Perintah Testing Cepat

Setelah semua setup selesai, `pppoe-client1` otomatis konek PPPoE saat start.
Gunakan Docker system daemon (bukan Podman) untuk semua perintah:

```bash
# Alias agar tidak perlu tulis DOCKER_HOST terus
alias dk='DOCKER_HOST=unix:///run/docker.sock docker'

cd docker/mikrotik

# Seed data dulu (jika belum)
go run ./cmd/seed/

# Start containers
DOCKER_HOST=unix:///run/docker.sock docker compose up -d

# --- TEST PPPOE (otomatis konek, tunggu ~15 detik) ---
DOCKER_HOST=unix:///run/docker.sock docker exec pppoe-client1 ip addr show ppp0
DOCKER_HOST=unix:///run/docker.sock docker exec pppoe-client1 ping -c 3 -I ppp0 192.168.111.1

# --- TEST HOTSPOT ---
# Buka browser: http://localhost:5800
# Firefox container → navigasi ke http://192.168.123.1
# Login manual dengan: hs-perm1 / HsPerm@11 (atau hs-perm2 / HsPerm@22)

# Verifikasi session PPPoE di MikroTik (jalankan di console RouterOS)
# /ppp active print
# Atau via REST API:
curl -s -u admin:admin http://192.168.111.1/rest/ppp/active
```
