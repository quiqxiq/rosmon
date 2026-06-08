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
         │    → port 5800 → host                            │
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

# Verifikasi
virsh net-list --all
ip link show virbr-hs
ip link show virbr-pppoe
```

Output yang diharapkan dari `virsh net-list`:

```text
 Name               State    Autostart   Persistent
---------------------------------------------------
 default            active   yes         yes
 mikrotik-hotspot   active   yes         yes
 mikrotik-pppoe     active   yes         yes
```

---

## Langkah 2 — Download MikroTik CHR

MikroTik **Cloud Hosted Router (CHR)** adalah image qcow2 yang berjalan
di KVM/QEMU dan cocok untuk GNOME Boxes.

1. Buka <https://mikrotik.com/download> → pilih **Cloud Hosted Router**
2. Download format **Raw disk image** (`.img`) atau **VMDK** lalu konversi
3. Atau download CHR Stable `.zip` → ekstrak → dapatkan `.img`

```bash
# Konversi ke qcow2 (opsional, lebih efisien)
qemu-img convert -f raw chr-7.x.x.img -O qcow2 chr-7.x.x.qcow2
```

---

## Langkah 3 — Import MikroTik ke GNOME Boxes

1. Buka **GNOME Boxes** → klik tombol **+** → pilih **Import a file**
2. Pilih file `chr-7.x.x.qcow2` (atau `.img`)
3. Beri nama VM: `MikroTik`
4. Alokasikan RAM minimal **128 MB**, storage **biarkan default**
5. Klik **Create**
6. Jalankan VM untuk memastikan RouterOS booting normal

> Default login RouterOS: `admin` / *(kosong — Enter saja)*

---

## Langkah 4 — Tambah Interface ke VM MikroTik

GNOME Boxes hanya menyediakan NIC pertama (ether1, terhubung ke `default`
libvirt network). Tambahkan ether2 dan ether3 via `virsh`.

```bash
# Cek nama domain VM (biasanya sama dengan nama di GNOME Boxes)
virsh list --all

# Matikan VM dulu jika sedang berjalan
virsh shutdown MikroTik

# Tambah ether2 → hotspot LAN
virsh attach-interface \
  --domain MikroTik \
  --type network \
  --source mikrotik-hotspot \
  --model virtio \
  --config

# Tambah ether3 → PPPoE server
virsh attach-interface \
  --domain MikroTik \
  --type network \
  --source mikrotik-pppoe \
  --model virtio \
  --config

# Verifikasi (harus ada 3 interface)
virsh domiflist MikroTik
```

Output yang diharapkan:

```text
 Interface   Type      Source             Model    MAC
-------------------------------------------------------------------
 vnet0       network   default            virtio   52:54:00:xx:xx:xx
 vnet1       network   mikrotik-hotspot   virtio   52:54:00:xx:xx:xx
 vnet2       network   mikrotik-pppoe     virtio   52:54:00:xx:xx:xx
```

Nyalakan VM kembali:

```bash
virsh start MikroTik
```

---

## Langkah 5 — Konfigurasi RouterOS

Buka console RouterOS di GNOME Boxes (klik VM → layar terminal muncul).
Login dengan `admin` + Enter.

### 5.1 IP Address

```routeros
# ether1 dapat IP dari default libvirt DHCP (192.168.122.x) — opsional beri static
/ip address add address=192.168.122.1/24   interface=ether1

# ether2 → hotspot LAN
/ip address add address=192.168.123.1/24   interface=ether2

# ether3 → PPPoE (tidak perlu IP langsung, PPPoE server yang handle)
/ip address add address=192.168.111.1/24   interface=ether3
```

### 5.2 IP Pool untuk PPPoE

```routeros
/ip pool add name=pppoe-pool ranges=192.168.111.2-192.168.111.100
```

### 5.3 PPP Profile

```routeros
/ppp profile add \
  name=Test \
  local-address=192.168.111.1 \
  remote-address=pppoe-pool \
  dns-server=8.8.8.8
```

### 5.4 User PPPoE

```routeros
/ppp secret add name=test password=1122 service=pppoe profile=Test
```

### 5.5 PPPoE Server

```routeros
/interface pppoe-server server add \
  interface=ether3 \
  service-name=pppoe \
  default-profile=Test \
  disabled=no
```

### 5.6 Hotspot

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

# Setup Hotspot
/ip hotspot setup
# Ikuti wizard:
#   hotspot interface: ether2
#   IP pool: hs-pool
#   DNS name: (kosong atau contoh: hotspot.local)
```

### 5.7 Verifikasi

```routeros
/ip address print
/ppp secret print
/interface pppoe-server server print
/ip hotspot print
```

---

## Langkah 6 — Setup Docker Compose

```bash
cd docker/mikrotik

# Copy konfigurasi
cp .env.template .env

# Sesuaikan jika nama bridge berbeda dari default
# (biasanya virbr-hs dan virbr-pppoe sesuai XML yang sudah dibuat)
# Cek dengan: ip link show type bridge

docker compose up -d
docker compose ps
```

Output yang diharapkan:

```text
NAME            IMAGE                    STATUS
hotspot-client1 jlesage/firefox:latest   Up
pppoe-client1   alpine:latest            Up
```

---

## Langkah 7 — Test Hotspot

1. Buka browser di Fedora: **<http://localhost:5800>**
2. Firefox dalam container muncul
3. Di address bar Firefox, ketik: **<http://192.168.123.1>**
4. Halaman login Hotspot MikroTik harus muncul
5. Login dengan user yang dibuat di RouterOS (default: `admin`)

> Jika hotspot redirect tidak bekerja, coba akses halaman lain dulu
> (misalnya `http://example.com`) — MikroTik akan redirect ke login page.

---

## Langkah 8 — Test PPPoE

```bash
# Masuk ke container PPPoE client
docker exec -it pppoe-client1 sh

# Di dalam container — mulai koneksi PPPoE
pppoe-start

# Cek status
pppoe-status

# Lihat interface PPP yang dibuat
ip addr show ppp0

# Cek routing baru via PPP
ip route show

# Ping ke router PPPoE (local address)
ping 192.168.111.1

# Putus koneksi
pppoe-stop
```

Jika berhasil, `pppoe-status` menampilkan:

```text
Connected!
pppoe-client1[xxx]: pppd (xxx) started at ...
ip address: 192.168.111.x
```

### Debug PPPoE

```bash
# Lihat PADI/PADO discovery di interface
tcpdump -i eth0 -n 'pppoed or pppoes'

# Log pppd secara verbose
pppd call pppoe debug nodetach
```

---

## Troubleshooting

### `macvlan: unknown parent interface`

Bridge libvirt belum aktif. Jalankan:

```bash
sudo virsh net-start mikrotik-pppoe
sudo virsh net-start mikrotik-hotspot
```

### PPPoE: `Timeout waiting for PADO packets`

1. Pastikan MikroTik VM berjalan dan PPPoE server aktif:

   ```routeros
   /interface pppoe-server server print
   ```

2. Cek interface ether3 di MikroTik muncul traffic:

   ```routeros
   /interface monitor-traffic ether3
   ```

3. Di container, cek interface eth0 ada di L2 yang benar:

   ```bash
   tcpdump -i eth0 -e -n ether proto 0x8863
   ```

   Harus terlihat PADI frame keluar dari container.

4. Pastikan nama bridge di `.env` sudah benar:

   ```bash
   ip link show type bridge
   # Cari virbr-pppoe dan virbr-hs
   ```

### Hotspot: tidak redirect ke login page

MikroTik hotspot intercept bekerja jika client berada di subnet hotspot.
Container `hotspot-client1` memiliki IP `192.168.123.200` (via macvlan),
jadi seharusnya tercakup. Cek:

```bash
docker exec hotspot-client1 ip addr show eth1
# Harus muncul 192.168.123.200
```

### `docker compose up` gagal: permission denied di macvlan

Docker membutuhkan NET_ADMIN di host untuk membuat macvlan. Pastikan user
masuk grup `docker`:

```bash
groups $USER   # harus ada "docker"
# Jika belum ada grup: sudo usermod -aG docker $USER && newgrp docker
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
