.PHONY: all setup \
	up down restart logs logs-svc ps \
	influx-token influx-enable \
	run dev dev-web \
	build build-web build-all \
	test test-race test-cover \
	test-integration test-integration-full \
	lint tidy update-golden clean \
	openapi-bundle openapi-lint openapi-bundle-check

# ── Tooling ────────────────────────────────────────────────────────────────────
# Support docker alias untuk podman (umum di Fedora/RHEL).
DOCKER  := $(shell which docker 2>/dev/null || which podman 2>/dev/null)
# --env-file memastikan .env di root project dibaca, bukan di docker/ subdirectory.
COMPOSE := $(DOCKER) compose --env-file .env -f docker/docker-compose.yml

ENV_FILE := .env

# ── First-time setup ───────────────────────────────────────────────────────────

all: build test

# Salin .env.example ke .env bila belum ada, lalu jalankan infra.
setup:
	@test -f $(ENV_FILE) || (cp .env.example $(ENV_FILE) && echo "✓ .env dibuat dari .env.example")
	@$(MAKE) up
	@echo ""
	@echo "Setup selesai. Jalankan 'make run' untuk start server."
	@echo "Opsional: 'make influx-token' untuk generate token InfluxDB3."

# ── Docker / Infra ─────────────────────────────────────────────────────────────

up:
	$(COMPOSE) up -d

down:
	$(COMPOSE) down

restart:
	$(COMPOSE) restart

# Restart satu service: make restart-svc SVC=influxdb3
restart-svc:
	$(COMPOSE) restart $(SVC)

# Rebuild + restart satu service (saat image berubah).
recreate-svc:
	$(COMPOSE) up -d --force-recreate $(SVC)

logs:
	$(COMPOSE) logs -f

# Log satu service: make logs-svc SVC=postgres
logs-svc:
	$(COMPOSE) logs -f $(SVC)

ps:
	$(COMPOSE) ps

# ── InfluxDB 3 token ───────────────────────────────────────────────────────────
# InfluxDB 3 Core berjalan dalam mode --without-auth secara default (cocok dev lokal).
# 'make influx-token' menghasilkan admin token via CLI influxdb3 di dalam container
# yang sedang berjalan. Token disimpan ke .env sebagai referensi — dibutuhkan jika
# Anda nanti ingin mengaktifkan auth di produksi.
#
# Syarat: influxdb3 container sudah berjalan (jalankan 'make up' dulu).

influx-token:
	@echo "Membuat admin token InfluxDB3..."
	@$(DOCKER) inspect rosmon-influx --format='{{.State.Running}}' 2>/dev/null | grep -q true \
		|| (echo "ERROR: Container rosmon-influx tidak berjalan. Jalankan 'make up' dulu." && exit 1)
	@set -e; \
	RAW=$$($(DOCKER) exec rosmon-influx influxdb3 create token --admin \
		--host http://localhost:8181 \
		--format json 2>&1); \
	echo "Output: $$RAW"; \
	TOKEN=$$(echo "$$RAW" | python3 -c \
		"import json,sys; d=json.load(sys.stdin); print(d.get('token','') or d.get('unhashed_token',''))" \
		2>/dev/null || echo "$$RAW" | grep -oP '(?<="token":")[^"]+' 2>/dev/null || \
		echo "$$RAW" | grep -oP 'apiv3_[A-Za-z0-9_-]+' 2>/dev/null); \
	if [ -z "$$TOKEN" ]; then \
		echo "ERROR: Tidak bisa mengekstrak token dari output. Lihat output di atas."; \
		exit 1; \
	fi; \
	if grep -q '^INFLUX_TOKEN=' $(ENV_FILE) 2>/dev/null; then \
		sed -i "s|^INFLUX_TOKEN=.*|INFLUX_TOKEN=$$TOKEN|" $(ENV_FILE); \
	else \
		printf '\nINFLUX_TOKEN=%s\n' "$$TOKEN" >> $(ENV_FILE); \
	fi; \
	echo ""; \
	echo "✓ INFLUX_TOKEN disimpan ke $(ENV_FILE)"; \
	echo "  Token: $$TOKEN"; \
	echo ""; \
	echo "Catatan: Server saat ini berjalan dalam mode --without-auth (tidak butuh token)."; \
	echo "INFLUX_TOKEN ini dipakai jika Anda nanti mengaktifkan auth di produksi."

# Set INFLUX_ENABLED=true di .env (aktifkan metrics InfluxDB di Go server).
influx-enable:
	@if grep -q '^INFLUX_ENABLED=' $(ENV_FILE) 2>/dev/null; then \
		sed -i 's|^INFLUX_ENABLED=.*|INFLUX_ENABLED=true|' $(ENV_FILE); \
	else \
		echo 'INFLUX_ENABLED=true' >> $(ENV_FILE); \
	fi
	@echo "✓ INFLUX_ENABLED=true di-set di $(ENV_FILE)"
	@echo "  Restart server agar perubahan berlaku: make run"

# ── Development servers ────────────────────────────────────────────────────────
# Muat .env lalu jalankan Go server (bash source agar komentar & nilai spasi aman).

run:
	@bash -c 'set -a; source $(ENV_FILE) 2>/dev/null; set +a; exec go run ./cmd/server'

# Frontend dev server (Vite HMR di http://localhost:5173).
dev-web:
	cd web && pnpm dev

# Jalankan backend + frontend sekaligus. Ctrl+C menghentikan keduanya.
dev:
	@trap 'kill 0' INT; \
	bash -c 'set -a; source $(ENV_FILE) 2>/dev/null; set +a; exec go run ./cmd/server' & \
	(cd web && pnpm dev) & \
	wait

# ── Build ──────────────────────────────────────────────────────────────────────

build:
	go build ./...

build-web:
	cd web && pnpm build

build-all: build build-web

# ── Test ───────────────────────────────────────────────────────────────────────

test:
	go test ./...

test-race:
	go test -race ./...

test-cover:
	go test -cover ./...
	go test -coverprofile=coverage.out ./...
	go tool cover -func=coverage.out | tail -n 1

# Integration test MikroTik (butuh router terhubung).
test-integration:
	go test -tags=integration -count=1 ./test/integration/...

# Full integration: DB (testcontainers) + MikroTik.
# Podman/CI tanpa Docker socket: TESTCONTAINERS_RYUK_DISABLED=true otomatis diset.
test-integration-full:
	TESTCONTAINERS_RYUK_DISABLED=true \
	go test -tags='integration dbtest' -v -count=1 ./test/integration/... ./mikrotik/...

# ── Code quality ───────────────────────────────────────────────────────────────

lint:
	golangci-lint run ./...

tidy:
	go mod tidy

update-golden:
	go test ./scripts/... -update

clean:
	rm -f coverage.out

# ── OpenAPI ────────────────────────────────────────────────────────────────────
# Bundle multi-file spec → single YAML yang di-embed ke binary (docs/embed.go).
# Scalar UI tidak handal resolve relative $ref di browser, bundle wajib di-regen
# setiap edit docs/openapi/{paths,schemas,components}.

openapi-bundle:
	npx -y @redocly/cli@latest bundle docs/openapi/openapi.yaml \
		--output docs/openapi/openapi.bundle.yaml --ext yaml

openapi-lint:
	npx -y @redocly/cli@latest lint docs/openapi/openapi.yaml \
		--config docs/openapi/redocly.yaml

# CI drift guard: fail kalau bundle tidak sinkron dengan yang di-commit.
openapi-bundle-check: openapi-bundle
	git diff --exit-code -- docs/openapi/openapi.bundle.yaml \
		|| (echo "ERROR: openapi.bundle.yaml out of sync; jalankan 'make openapi-bundle' dan commit" && exit 1)
