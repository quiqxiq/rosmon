# test-pppoe.ps1 — Test PPPoE ke MikroTik dari Windows host
#
# Menggunakan Windows RAS (Remote Access Service) untuk dial PPPoE
# via VirtualBox Host-Only Ethernet Adapter, yang terhubung langsung
# di L2 ke ether3 MikroTik (PPPoE server).
#
# Jalankan sebagai Administrator: .\test-pppoe.ps1
#
# Requirements:
#   - VirtualBox VM MikroTik sedang berjalan
#   - PPPoE server aktif di ether3 (192.168.111.1)
#   - Credentials: test / 1122

param(
    [string]$User     = "test",
    [string]$Password = "1122",
    [string]$ConnName = "MikroTik-PPPoE-Test"
)

$ErrorActionPreference = "Stop"

function Write-Status($msg) { Write-Host "[*] $msg" -ForegroundColor Cyan }
function Write-OK($msg)     { Write-Host "[+] $msg" -ForegroundColor Green }
function Write-Fail($msg)   { Write-Host "[-] $msg" -ForegroundColor Red }

# ─── 1. Cek admin ─────────────────────────────────────────────────────────────
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Fail "Jalankan sebagai Administrator!"
    exit 1
}

# ─── 2. Cek VirtualBox Host-Only adapter tersedia ─────────────────────────────
Write-Status "Mencari VirtualBox Host-Only Ethernet Adapter..."
$vboxAdapter = Get-NetAdapter | Where-Object { $_.InterfaceDescription -like "*VirtualBox Host-Only*" } | Select-Object -First 1
if (-not $vboxAdapter) {
    Write-Fail "VirtualBox Host-Only Ethernet Adapter tidak ditemukan!"
    exit 1
}
Write-OK "Adapter: $($vboxAdapter.Name) ($($vboxAdapter.InterfaceDescription))"

# ─── 3. Hapus koneksi lama jika ada ──────────────────────────────────────────
$existing = Get-VpnConnection -Name $ConnName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Status "Menghapus koneksi lama '$ConnName'..."
    Remove-VpnConnection -Name $ConnName -Force -PassThru | Out-Null
}

# ─── 4. Buat broadband (PPPoE) connection via .pbk ───────────────────────────
Write-Status "Membuat koneksi PPPoE '$ConnName'..."

$rasDir  = "$env:APPDATA\Microsoft\Network\Connections\Pbk"
$pbkPath = "$rasDir\rasphone.pbk"
New-Item -ItemType Directory -Force -Path $rasDir | Out-Null

# Cari GUID interface
$ifIndex = $vboxAdapter.ifIndex

# Buat atau append ke .pbk
$pbkEntry = @"

[$ConnName]
MEDIA=rastapi
Port=VPN*
Device=WAN Miniport (PPPOE)
DEVICE=rastapi
AutoLogon=0
DialParamsUID=1234567
Type=4
EncryptionType=0
LongDistance=0
AreaCode=
Prefix=
Suffix=
Guid=
VpnStrategy=0
ExcludedProtocols=0
LcpExtensions=1
DataEncryption=0
SwCompression=0
NegotiateMultilinkAlways=0
SkipNwcWarning=0
SkipDownLevelDialog=0
SkipDoubleDialDialog=0
DialPercent=0
DialSeconds=0
HangUpPercent=0
HangUpSeconds=0
RedialAttempts=3
RedialSeconds=60
IdleSeconds=0
NumberOfPhoneNumbers=1
DisableModemSpeaker=0
DisableConnectionQuery=0
ModemSettings=
Description=
LastSelectedPhone=0
PromoteAlternates=0
SharedPhoneNumbers=0
GlobalDeviceSettings=0
PreferModemProfiles=0
AutoSelectDevice=0
HLimitMax=103
HLimitMin=0
HLimitRevs=0
HLimitModemPool=0
BaseProtocol=1
Authentication=2
CustomAuthKey=0
CustomScript=
AuthenticateServer=0
SecureLocalFiles=0
RequireEncryption=0
RequireMSEncryptedPw=0
RequireDataEncryption=0
RequireEAP=0
RequirePAP=0
RequireSPAP=0
RequireCHAP=0
RequireMSCHAP=0
RequireMSCHAP2=1
EapTypeId=0
IpPrioritizeRemote=1
IpHeaderCompression=0
IpAddress=0.0.0.0
IpDnsAddress=0.0.0.0
IpDns2Address=0.0.0.0
IpWinsAddress=0.0.0.0
IpWins2Address=0.0.0.0
IpAssign=1
IpNameAssign=1
IpFrameSize=1500
IpDnsFlags=0
IpNBTFlags=1
TcpWindowSize=0
UseFlags=2
IpSecFlags=0
Share=1
"@

if (Test-Path $pbkPath) {
    $content = Get-Content $pbkPath -Raw
    if ($content -notmatch [regex]::Escape("[$ConnName]")) {
        Add-Content -Path $pbkPath -Value $pbkEntry
    }
} else {
    Set-Content -Path $pbkPath -Value $pbkEntry
}
Write-OK "Phonebook entry dibuat di $pbkPath"

# ─── 5. Dial koneksi menggunakan rasdial ──────────────────────────────────────
Write-Status "Mencoba dial PPPoE dengan user='$User'..."
$dialResult = & rasdial.exe $ConnName $User $Password 2>&1
Write-Host $dialResult

if ($LASTEXITCODE -eq 0) {
    Write-OK "PPPoE BERHASIL terhubung!"
    Write-Status "Interface PPPoE:"
    Get-NetAdapter | Where-Object { $_.InterfaceDescription -like "*WAN Miniport*" -and $_.Status -eq "Up" } |
        Select-Object Name, InterfaceDescription, Status | Format-Table -AutoSize

    $pppIP = Get-NetIPAddress -InterfaceAlias "ppp*" -ErrorAction SilentlyContinue
    if ($pppIP) {
        Write-OK "IP yang diterima: $($pppIP.IPAddress)"
    }

    Write-Status "Memutus koneksi..."
    & rasdial.exe $ConnName /DISCONNECT | Out-Null
    Write-OK "Koneksi diputus. Test PPPoE SUKSES!"
} else {
    Write-Fail "PPPoE gagal (exit=$LASTEXITCODE). Output: $dialResult"
    Write-Host ""
    Write-Host "Kemungkinan penyebab:" -ForegroundColor Yellow
    Write-Host "  1. MikroTik VM belum berjalan atau PPPoE server disabled"
    Write-Host "  2. Credentials salah (user=$User)"
    Write-Host "  3. VirtualBox Host-Only adapter tidak terhubung ke ether3 MikroTik"
    Write-Host "  4. IP pool PPPoE belum dikonfigurasi di MikroTik (ppp/profile)"
}

# ─── 6. Cleanup ──────────────────────────────────────────────────────────────
Write-Status "Membersihkan koneksi test..."
& rasdial.exe $ConnName /DISCONNECT 2>$null | Out-Null
