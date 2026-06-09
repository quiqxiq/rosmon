#!/usr/bin/env bash
# test-all.sh — Rosmon Seed Testing Master Script
#
# Menjalankan testing end-to-end untuk:
#   - 5 customer PPPoE (pppoe-user1 s/d pppoe-user5)
#   - 2 customer hotspot permanent (hs-perm1, hs-perm2)
#   - 3 voucher hotspot (dari .vouchers.json)
#
# Prerequisites:
#   1. MikroTik VM running dengan konfigurasi PPPoE + Hotspot
#   2. go run ./cmd/seed/ sudah dijalankan (seed data di DB + MikroTik)
#   3. virbr-hs dan virbr-pppoe bridge UP
#   4. sudo modprobe macvlan sudah dijalankan
#   5. DOCKER_HOST tidak menunjuk ke Podman (unset DOCKER_HOST)
#
# Usage:
#   cd docker/mikrotik
#   bash test-all.sh
#
# Exit code: 0 jika semua test PASS, 1 jika ada yang FAIL

set -euo pipefail

DOCKER="docker"
COMPOSE_FILE="docker-compose.test.yaml"
PPPOE_GW="192.168.111.1"
HOTSPOT_GW="192.168.123.1"
VOUCHER_FILE=".vouchers.json"
# Set KEEP_ON_FAIL=1 atau pass --keep untuk tidak cleanup jika ada test gagal
KEEP_ON_FAIL="${KEEP_ON_FAIL:-0}"
[[ "${1:-}" == "--keep" ]] && KEEP_ON_FAIL=1

# Warna output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PASS=0
FAIL=0
SKIP=0

log_info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
log_ok()    { echo -e "${GREEN}[PASS]${NC}  $*"; PASS=$((PASS+1)); }
log_fail()  { echo -e "${RED}[FAIL]${NC}  $*"; FAIL=$((FAIL+1)); }
log_skip()  { echo -e "${YELLOW}[SKIP]${NC}  $*"; SKIP=$((SKIP+1)); }
log_title() { echo; echo -e "${CYAN}══════════════════════════════════════${NC}"; echo -e "${CYAN}  $*${NC}"; echo -e "${CYAN}══════════════════════════════════════${NC}"; }

# Pastikan DOCKER_HOST tidak ke Podman
check_docker_host() {
    if [[ "${DOCKER_HOST:-}" == *podman* ]]; then
        echo -e "${RED}ERROR: DOCKER_HOST=$DOCKER_HOST menunjuk ke Podman.${NC}"
        echo "Jalankan: unset DOCKER_HOST"
        exit 1
    fi
    local server
    server=$($DOCKER version --format '{{.Server.Version}}' 2>/dev/null || true)
    if [[ -z "$server" ]]; then
        echo -e "${RED}ERROR: Docker daemon tidak bisa diakses.${NC}"
        exit 1
    fi
    log_info "Docker server version: $server"
}

# Start containers
start_containers() {
    log_title "Menjalankan containers"

    if [[ ! -f "$VOUCHER_FILE" ]]; then
        log_skip "Voucher file $VOUCHER_FILE tidak ditemukan — test voucher akan di-skip"
        log_info "Jalankan: go run ./cmd/seed/ untuk generate voucher"
    fi

    $DOCKER compose -f "$COMPOSE_FILE" up -d 2>&1 | grep -E "Created|Started|Running|Error" || true
    log_info "Menunggu containers UP (30 detik untuk apk install + pppd connect)..."
    sleep 30
}

# Cek satu PPPoE container
test_pppoe() {
    local container="$1"
    local username="$2"
    local profile="$3"

    # Tampilkan 5 baris terakhir pppd.log selalu (untuk debug)
    local pppd_log
    pppd_log=$($DOCKER exec "$container" sh -c "tail -5 /var/log/pppd.log 2>/dev/null" 2>/dev/null || true)

    # Cek ppp0 interface exist
    if ! $DOCKER exec "$container" ip addr show ppp0 >/dev/null 2>&1; then
        log_fail "PPPoE $username ($container): ppp0 tidak UP"
        if [[ -n "$pppd_log" ]]; then
            echo -e "    ${YELLOW}pppd.log:${NC}"
            echo "$pppd_log" | sed 's/^/      /'
        else
            echo "    (pppd.log kosong — apk install mungkin gagal atau timeout)"
        fi
        return
    fi

    # Ambil IP yang didapat dari PPPoE server
    local ppp_ip
    ppp_ip=$($DOCKER exec "$container" sh -c "ip addr show ppp0 | grep 'inet ' | awk '{print \$2}'" 2>/dev/null || echo "?")

    # Ping ke MikroTik via ppp0
    if $DOCKER exec "$container" ping -c 2 -W 2 -I ppp0 "$PPPOE_GW" >/dev/null 2>&1; then
        log_ok "PPPoE $username ($profile) → IP=$ppp_ip ping $PPPOE_GW OK"
    else
        log_fail "PPPoE $username ($profile) → IP=$ppp_ip ping $PPPOE_GW GAGAL"
    fi
}

# Test semua PPPoE
test_all_pppoe() {
    log_title "Test PPPoE (5 customers)"

    # Tunggu sampai pppd terhubung (ppp0 UP) — max 30 detik per container
    local containers=("pppoe-test-1" "pppoe-test-2" "pppoe-test-3" "pppoe-test-4" "pppoe-test-5")
    local users=("pppoe-user1" "pppoe-user2" "pppoe-user3" "pppoe-user4" "pppoe-user5")
    local profiles=("paket-bronze" "paket-silver" "paket-gold" "paket-bronze" "paket-silver")

    for i in "${!containers[@]}"; do
        local c="${containers[$i]}"
        local u="${users[$i]}"
        local p="${profiles[$i]}"

        # Tunggu ppp0 max 45 detik
        local waited=0
        while ! $DOCKER exec "$c" ip addr show ppp0 >/dev/null 2>&1 && [[ $waited -lt 45 ]]; do
            sleep 3
            waited=$((waited+3))
        done

        test_pppoe "$c" "$u" "$p"
    done
}

# Test hotspot login via curl (captive portal POST)
test_hotspot_login() {
    local username="$1"
    local password="$2"
    local label="$3"

    # POST ke halaman login hotspot MikroTik
    local resp
    resp=$($DOCKER exec hotspot-test curl -s -L \
        --max-time 5 \
        --interface eth0 \
        -X POST "http://$HOTSPOT_GW/login" \
        -d "username=$username&password=$password&dst=http://example.com" \
        2>/dev/null || echo "")

    if echo "$resp" | grep -qi "logout\|connected\|You are logged in\|status\|hs-status"; then
        log_ok "Hotspot $label ($username) login OK"
        # Logout agar slot tersedia untuk user berikutnya
        $DOCKER exec hotspot-test curl -s \
            --interface eth0 \
            "http://$HOTSPOT_GW/logout" >/dev/null 2>&1 || true
        sleep 1
    elif echo "$resp" | grep -qi "error\|wrong\|invalid"; then
        log_fail "Hotspot $label ($username) login DITOLAK"
    else
        # Fallback: cek apakah kita bisa akses internet (hotspot granted)
        if $DOCKER exec hotspot-test ping -c 2 -W 3 8.8.8.8 >/dev/null 2>&1; then
            log_ok "Hotspot $label ($username) login OK (verifikasi via ping)"
            $DOCKER exec hotspot-test curl -s --interface eth0 \
                "http://$HOTSPOT_GW/logout" >/dev/null 2>&1 || true
            sleep 1
        else
            log_fail "Hotspot $label ($username) login tidak dapat dikonfirmasi"
        fi
    fi
}

# Test hotspot permanent customers
test_all_hotspot_perm() {
    log_title "Test Hotspot Permanent (2 customers)"

    # Cek hotspot-test container ready
    if ! $DOCKER exec hotspot-test curl --version >/dev/null 2>&1; then
        log_info "Menunggu hotspot-test siap..."
        sleep 10
    fi

    test_hotspot_login "hs-perm1" "HsPerm@11" "permanent (hs-basic)"
    test_hotspot_login "hs-perm2" "HsPerm@22" "permanent (hs-kantor)"
}

# Test voucher customers (ambil 3 pertama dari .vouchers.json)
test_all_vouchers() {
    log_title "Test Hotspot Voucher (3 vouchers)"

    if [[ ! -f "$VOUCHER_FILE" ]]; then
        log_skip "Voucher file tidak ditemukan, skip voucher test"
        log_skip "  Jalankan: go run ./cmd/seed/"
        return
    fi

    # Ambil 3 voucher pertama (username:password:profile)
    local vouchers
    vouchers=$(cat "$VOUCHER_FILE" | $DOCKER exec -i hotspot-test jq -r '.[0:3][] | "\(.username):\(.password):\(.profile)"' 2>/dev/null || \
               python3 -c "import json; d=json.load(open('$VOUCHER_FILE')); [print(v['username']+':'+v['password']+':'+v.get('profile','?')) for v in d[:3]]" 2>/dev/null || \
               echo "")

    if [[ -z "$vouchers" ]]; then
        log_skip "Gagal membaca voucher dari $VOUCHER_FILE"
        return
    fi

    local idx=1
    while IFS=: read -r user pass profile; do
        [[ -z "$user" ]] && continue
        test_hotspot_login "$user" "$pass" "voucher-$idx ($profile)"
        idx=$((idx+1))
        [[ $idx -gt 3 ]] && break
    done <<< "$vouchers"
}

# Ringkasan
print_summary() {
    local total=$((PASS + FAIL + SKIP))
    echo
    echo -e "${CYAN}╔══════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║     Rosmon Seed Test — Ringkasan     ║${NC}"
    echo -e "${CYAN}╠══════════════════════════════════════╣${NC}"
    echo -e "${CYAN}║${NC}  Total tests  : ${total}"
    echo -e "${CYAN}║${NC}  ${GREEN}PASS${NC}          : ${PASS}"
    echo -e "${CYAN}║${NC}  ${RED}FAIL${NC}          : ${FAIL}"
    echo -e "${CYAN}║${NC}  ${YELLOW}SKIP${NC}          : ${SKIP}"
    echo -e "${CYAN}╚══════════════════════════════════════╝${NC}"
    echo

    if [[ $FAIL -gt 0 ]]; then
        echo -e "${YELLOW}Tips debug:${NC}"
        echo "  docker logs pppoe-test-1   # lihat log PPPoE"
        echo "  docker exec pppoe-test-1 cat /var/log/pppd.log"
        echo "  docker exec hotspot-test arping -c 3 -I eth0 $HOTSPOT_GW"
        echo
        return 1
    fi
    return 0
}

# Stop containers
stop_containers() {
    if [[ $FAIL -gt 0 && "$KEEP_ON_FAIL" == "1" ]]; then
        log_title "Containers dibiarkan hidup (--keep / FAIL>0)"
        echo "  Debug commands:"
        echo "    docker logs pppoe-test-1"
        echo "    docker exec pppoe-test-1 cat /var/log/pppd.log"
        echo "    docker exec hotspot-test arping -c 3 -I eth0 $HOTSPOT_GW"
        echo "  Cleanup manual: docker compose -f $COMPOSE_FILE down"
        return
    fi
    log_title "Cleanup"
    $DOCKER compose -f "$COMPOSE_FILE" down 2>&1 | grep -E "Removed|Stopped" || true
}

# ─── Main ───────────────────────────────────────────────────────────────────
cd "$(dirname "$0")"

echo
echo -e "${CYAN}Rosmon Seed Test — $(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo

check_docker_host
start_containers
test_all_pppoe
test_all_hotspot_perm
test_all_vouchers

# Selalu cleanup setelah test
stop_containers

print_summary
