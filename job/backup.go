package job

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/quiqxiq/rosmon/store"
	"github.com/sirupsen/logrus"
)

// BackupJob melakukan backup harian:
// 1. Dump database Postgres via pg_dump + gzip
// 2. Hapus backup yang lebih tua dari retention_days
type BackupJob struct {
	SettingStore store.SettingStore
	DatabaseDSN  string
	Log          *logrus.Logger
}

func NewBackupJob(settings store.SettingStore, dbDSN string, log *logrus.Logger) *BackupJob {
	if log == nil {
		log = logrus.New()
	}
	return &BackupJob{SettingStore: settings, DatabaseDSN: dbDSN, Log: log}
}

// Run adalah entry point backup job. Idempotent — aman dijalankan ulang.
func (j *BackupJob) Run(ctx context.Context) error {
	if j.SettingStore == nil {
		return nil
	}

	enabled, _ := j.SettingStore.Get(ctx, "backup.enabled")
	if enabled != "true" {
		return nil
	}

	backupPath, _ := j.SettingStore.Get(ctx, "backup.path")
	if backupPath == "" {
		backupPath = "./backups"
	}
	retentionStr, _ := j.SettingStore.Get(ctx, "backup.retention_days")
	retentionDays := 7
	if n, err := strconv.Atoi(retentionStr); err == nil && n > 0 {
		retentionDays = n
	}

	// Buat direktori backup jika belum ada.
	if err := os.MkdirAll(backupPath, 0o755); err != nil {
		return fmt.Errorf("backup: mkdir: %w", err)
	}

	stamp := time.Now().Format("2006-01-02")
	j.Log.WithField("stamp", stamp).Info("backup: start")

	// 1. DB dump
	if j.DatabaseDSN != "" {
		if err := j.dumpDB(ctx, backupPath, stamp); err != nil {
			j.Log.WithError(err).Warn("backup: db dump failed")
		}
	}

	// 2. Hapus backup lama
	j.cleanOld(backupPath, retentionDays)

	j.Log.Info("backup: done")
	return nil
}

func (j *BackupJob) dumpDB(ctx context.Context, dir, stamp string) error {
	outFile := filepath.Join(dir, fmt.Sprintf("db-%s.sql.gz", stamp))

	// Gunakan pg_dump jika tersedia.
	pgDump, err := exec.LookPath("pg_dump")
	if err != nil {
		j.Log.Warn("backup: pg_dump not found, skipping DB backup")
		return nil
	}

	cmd := exec.CommandContext(ctx, "sh", "-c",
		fmt.Sprintf("%s %s | gzip > %s", pgDump, shellQuote(j.DatabaseDSN), outFile))
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("pg_dump: %w: %s", err, string(out))
	}
	j.Log.WithField("file", outFile).Info("backup: db dump ok")
	return nil
}

func (j *BackupJob) cleanOld(dir string, retentionDays int) {
	cutoff := time.Now().AddDate(0, 0, -retentionDays)
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		if info.ModTime().Before(cutoff) {
			path := filepath.Join(dir, e.Name())
			_ = os.Remove(path)
			j.Log.WithField("file", path).Debug("backup: removed old file")
		}
	}
}

func shellQuote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", "'\\''") + "'"
}
