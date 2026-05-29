package onlogin

import (
	"fmt"
	"strings"

	"github.com/quiqxiq/rosmon/domain"
)

// Build menghasilkan body script on-login untuk parameter o. Output bukan
// di-quote — caller bertanggung jawab embed ke value `=on-login=...`
// secara apa adanya (RouterOS API protocol length-prefix word, jadi tidak
// butuh escape kuotasi level kawat).
//
// Cross-ref: analisis §3.1.
//
// MVP refactor: writeRecordBlock (write ke /system/script RouterOS)
// digantikan oleh writeWebhookBlock — fire-and-forget /tool/fetch ke Go
// service. Selling record sekarang langsung ke PostgreSQL via webhook
// handler. Mode "c" suffix (remc/ntfc) tetap dipertahankan untuk
// kompatibilitas dengan service/expiry yang masih record di expiry time.
func Build(o Options) string {
	var b strings.Builder
	writeMetadata(&b, o)

	if o.Mode == domain.ModeNone {
		// Mode 0: hanya metadata + tidak ada blok logika. PHP tetap dapat
		// parse harga via metadata `:put`.
		return b.String()
	}

	writeExpiryBlock(&b, o)

	if o.LockMAC {
		writeLockMACBlock(&b)
	}

	// Webhook fire-and-forget — dipanggil saat tiap login (bukan hanya
	// first login). Webhook handler di Go service yang melakukan dedup
	// supaya hanya first login per user yang ter-record.
	writeWebhookBlock(&b, o)

	return b.String()
}

// writeMetadata menulis baris `:put` yang dipakai PHP untuk parse balik
// konfigurasi profile.
//
// Format mode != 0:  ",<expmode>,<price>,<validity>,<sprice>,,<lock>,"
// Format mode == 0:  ",,<price>,,,noexp,<lock>,"
func writeMetadata(b *strings.Builder, o Options) {
	if o.Mode == domain.ModeNone {
		fmt.Fprintf(b, `:put (",,%d,,,noexp,%s,");`+"\n", o.Price, o.metadataLockToken())
		return
	}
	fmt.Fprintf(b,
		`:put (",%s,%d,%s,%d,,%s,");`+"\n",
		o.Mode, o.Price, o.Validity, o.SellPrice, o.metadataLockToken(),
	)
}

func writeExpiryBlock(b *strings.Builder, o Options) {
	const tpl = `{
  :local comment [/ip hotspot user get [/ip hotspot user find where name="$user"] comment];
  :local ucode [:pic $comment 0 2];
  :if ($ucode = "vc" or $ucode = "up" or $comment = "") do={
    :local date  [/system clock get date];
    :local year  [:pick $date 7 11];
    /sys sch add name="$user" disable=no start-date=$date interval="<VALIDITY>";
    :delay 5s;
    :local exp    [/sys sch get [/sys sch find where name="$user"] next-run];
    :local getxp  [len $exp];
    :if ($getxp = 15) do={
      :local d [:pic $exp 0 6];
      :local t [:pic $exp 7 16];
      :local s ("/");
      :local exp ("$d$s$year $t");
      /ip hotspot user set comment="$exp" [find where name="$user"];
    };
    :if ($getxp = 8) do={
      /ip hotspot user set comment="$date $exp" [find where name="$user"];
    };
    :if ($getxp > 15) do={
      /ip hotspot user set comment="$exp" [find where name="$user"];
    };
    :delay 5s;
    /sys sch remove [find where name="$user"];
  }
}
`
	b.WriteString(strings.ReplaceAll(tpl, "<VALIDITY>", o.Validity))
}

func writeLockMACBlock(b *strings.Builder) {
	b.WriteString(`:local mac $"mac-address";
/ip hotspot user set mac-address=$mac [find where name=$user];
`)
}

// writeWebhookBlock menulis blok /tool/fetch fire-and-forget yang memanggil
// Go service saat user login. URL dikonfigurasi via Options.WebhookURL.
//
// Kalau WebhookURL kosong, blok tidak di-emit (mis. Go service belum
// di-konfigurasi → script tidak akan retry-loop ke endpoint kosong).
//
// `keep-result=no` supaya tidak menyimpan response file di flash.
// `on-error={}` membuat script tidak gagal kalau Go service down — login
// user tetap berhasil, hanya selling record yang di-skip.
//
// Variabel `$user`, `$"mac-address"`, dan `$address` disubstitusi oleh
// hotspot subsystem RouterOS saat script di-eksekusi. ProfileName di-embed
// di payload sebagai literal string supaya webhook handler tidak perlu
// query RouterOS untuk tahu profile.
func writeWebhookBlock(b *strings.Builder, o Options) {
	if o.WebhookURL == "" {
		return
	}
	fmt.Fprintf(b, `:do {
  /tool fetch mode=http http-method=post keep-result=no url=("%s") http-data=("user=" . $user . "&mac=" . $"mac-address" . "&ip=" . $address . "&profile=%s");
} on-error={}
`, o.WebhookURL, o.ProfileName)
}
