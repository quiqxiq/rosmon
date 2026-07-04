package sse

import "fmt"

// Topic constants — naming stabil untuk monitoring/log.
const (
	TopicHotspotActive           = "hotspot-active"
	TopicHotspotActiveFollowOnly = "hotspot-active-follow-only"
	TopicPPPActive               = "ppp-active"

	// Tabel follow streams (analisis §1.6, §1.12).
	TopicHotspotUser           = "hotspot-user"
	TopicHotspotUserFollowOnly = "hotspot-user-follow-only"
	TopicPPPSecret             = "ppp-secret"
	TopicPPPSecretFollowOnly   = "ppp-secret-follow-only"

	// Derived inactive streams (analisis §4 — workflows).
	TopicHotspotInactive = "hotspot-inactive"
	TopicPPPInactive     = "ppp-inactive"
)

// TopicPayments untuk notifikasi admin real-time saat pelanggan mengunggah
// bukti pembayaran manual di portal. Topic global (bukan per-device).
const TopicPayments = "payments"

// TopicLog membentuk topic untuk subscription /log/print follow dengan
// filter topics. Kosong = semua topics.
func TopicLog(topics string) string {
	if topics == "" {
		return "log:all"
	}
	return "log:" + topics
}

// TopicResource membentuk topic untuk poll /system/resource interval.
func TopicResource(interval string) string {
	return fmt.Sprintf("resource:%s", interval)
}

// TopicInterfaceTraffic untuk inherent stream monitor-traffic per iface.
func TopicInterfaceTraffic(iface string) string {
	return "traffic:" + iface
}

// TopicInterfaceStats untuk /interface/print stats interval=...
func TopicInterfaceStats(interval string) string {
	return "interface-stats:" + interval
}

// TopicQueueStats untuk /queue/simple/print stats interval=...
func TopicQueueStats(interval string) string {
	return "queue-stats:" + interval
}

// TopicPing untuk /ping stream ke target address.
func TopicPing(address string) string {
	return "ping:" + address
}

// TopicRouterboard untuk poll /system/routerboard/print interval.
func TopicRouterboard(interval string) string {
	return "routerboard:" + interval
}

// TopicQueueStatsByName untuk /queue/simple/print stats ?name=<name> interval.
func TopicQueueStatsByName(name, interval string) string {
	return "queue-stats-name:" + name + ":" + interval
}

// TopicParentQueueStats untuk /queue/simple/print stats ?dynamic=false interval.
func TopicParentQueueStats(interval string) string {
	return "queue-stats-parent:" + interval
}
