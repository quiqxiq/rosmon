.PHONY: all setup \
	up up-dev down down-dev restart restart-dev logs logs-dev ps ps-dev \
	build-docker build-docker-dev rebuild rebuild-dev \
	influx-token influx-enable \
	run dev dev-web \
	build build-web build-all \
	test test-race test-cover \
	test-integration test-integration-full \
	lint tidy update-golden clean \
	openapi-bundle openapi-lint openapi-bundle-check

# ── Tooling ────────────────────────────────────────────────────────────────────
# Support docker alias untuk podman (umum di Fedora/RHEL/Windows).
DOCKER  := $(shell which docker 2>/dev/null || which podman 2>/dev/null || echo docker)
# --env-file memastikan .env di root project dibaca.
COMPOSE := $(DOCKER) compose --env-file .env -f docker/docker-compose.yml
COMPOSE_DEV := $(DOCKER) compose --env-file .env -f docker/docker-compose-dev.yml

ENV_FILE := .env

all: build test

# ── First-time setup (Cross-Platform via Go) ───────────────────────────────────

# Menjalankan script setup otomatis (membuat .env, generate JWT_SECRET & crypto key,
# mendownload dependencies go & npm frontend jika pnpm terinstal).
setup:
	@go run scripts/setup/main.go

# ── Docker Compose Production Full Stack ──────────────────────────────────────

# Menjalankan full stack production mode (Postgres + InfluxDB + Backend + Frontend via Nginx).
up:
	$(COMPOSE) up -d

# Mematikan full stack production mode.
down:
	$(COMPOSE) down

# Me-restart service production.
restart:
	$(COMPOSE) restart

# Log full stack production.
logs:
	$(COMPOSE) logs -f

# Status service production.
ps:
	$(COMPOSE) ps

# Build docker image untuk production.
build-docker:
	$(COMPOSE) build

# Rebuild total (clean build) docker image production.
rebuild:
	$(COMPOSE) down -v
	$(COMPOSE) build --no-cache
	$(COMPOSE) up -d --force-recreate

# ── Docker Compose Development Full Stack ─────────────────────────────────────

# Menjalankan full stack development mode (Postgres + InfluxDB + Backend + Frontend via Vite dev).
up-dev:
	$(COMPOSE_DEV) up -d

# Mematikan full stack development mode.
down-dev:
	$(COMPOSE_DEV) down

# Me-restart service development.
restart-dev:
	$(COMPOSE_DEV) restart

# Log full stack development.
logs-dev:
	$(COMPOSE_DEV) logs -f

# Status service development.
ps-dev:
	$(COMPOSE_DEV) ps

# Build docker image untuk development.
build-docker-dev:
	$(COMPOSE_DEV) build

# Rebuild total (clean build) docker image development.
rebuild-dev:
	$(COMPOSE_DEV) down -v
	$(COMPOSE_DEV) build --no-cache
	$(COMPOSE_DEV) up -d --force-recreate

# ── InfluxDB 3 Token (Cross-Platform via Go) ───────────────────────────────────

# Membuat admin token InfluxDB3 dari container yang sedang berjalan secara otomatis
# dan menyimpannya langsung ke file .env. Bekerja di Windows, macOS, & Linux!
influx-token:
	@go run scripts/influx-token/main.go

# Set INFLUX_ENABLED=true di .env secara manual (alternatif).
influx-enable:
	@go run scripts/influx-token/main.go

# ── Development servers (Local Runner) ────────────────────────────────────────

# Menjalankan Go backend server secara langsung menggunakan local env.
run:
	@bash -c 'set -a; source $(ENV_FILE) 2>/dev/null; set +a; exec go run ./cmd/server' || go run ./cmd/server

# Menjalankan frontend dev server secara langsung (Vite HMR di http://localhost:5173).
dev-web:
	cd web && pnpm dev

# Jalankan backend + frontend lokal sekaligus. Ctrl+C menghentikan keduanya.
dev:
	@trap 'kill 0' INT; \
	(go run ./cmd/server) & \
	(cd web && pnpm dev) & \
	wait

# ── Local Compilation ─────────────────────────────────────────────────────────

build:
	go build ./...

build-web:
	cd web && pnpm build

build-all: build build-web

# ── Testing ───────────────────────────────────────────────────────────────────

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
test-integration-full:
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
