//go:build dbtest

package testutil

import (
	"context"
	"testing"
	"time"

	"github.com/quiqxiq/rosmon/store"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
	gormpg "gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// NewPostgres start postgres testcontainer, apply migrations, return *gorm.DB.
// Skip otomatis kalau Docker tidak tersedia. Cleanup container otomatis via
// t.Cleanup.
//
// Butuh Docker running. Test yang pakai ini di-gate dengan build tag `dbtest`
// supaya CI bisa pilih kapan menjalankan layer DB.
func NewPostgres(t *testing.T) *gorm.DB {
	t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	container, err := tcpostgres.Run(ctx,
		"postgres:16-alpine",
		tcpostgres.WithDatabase("mikhmon_test"),
		tcpostgres.WithUsername("test"),
		tcpostgres.WithPassword("test"),
		tcpostgres.BasicWaitStrategies(),
	)
	if err != nil {
		t.Skipf("testutil: cannot start postgres container (Docker available?): %v", err)
	}
	t.Cleanup(func() {
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer shutdownCancel()
		_ = container.Terminate(shutdownCtx)
	})

	dsn, err := container.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		t.Fatalf("testutil: cannot get connection string: %v", err)
	}

	db, err := gorm.Open(gormpg.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("testutil: gorm open: %v", err)
	}

	if err := store.Migrate(db); err != nil {
		t.Fatalf("testutil: migrate: %v", err)
	}
	return db
}

// NewStores wrap NewPostgres + return ketiga store yang sering dipakai
// test expiry service.
func NewStores(t *testing.T) (store.DeviceStore, store.HotspotProfileStore, store.TransactionStore) {
	t.Helper()
	db := NewPostgres(t)
	return store.NewDeviceStore(db), store.NewHotspotProfileStore(db), store.NewTransactionStore(db)
}
