.PHONY: all build test test-race test-cover test-integration test-integration-full lint tidy update-golden clean \
	openapi-bundle openapi-lint openapi-bundle-check

all: build test

build:
	go build ./...

test:
	go test ./...

test-race:
	go test -race ./...

test-cover:
	go test -cover ./...
	go test -coverprofile=coverage.out ./...
	go tool cover -func=coverage.out | tail -n 1

test-integration:
	go test -tags=integration -count=1 ./test/integration/...

# test-integration-full: jalankan semua integration test + DB test.
# Butuh POSTGRES_URL diset dan MikroTik router terhubung.
# Disable Ryuk untuk env CI yang tidak support Docker socket.
test-integration-full:
	TESTCONTAINERS_RYUK_DISABLED=true go test -tags='integration dbtest' -v -count=1 ./test/integration/... ./mikrotik/...

lint:
	golangci-lint run ./...

tidy:
	go mod tidy

update-golden:
	go test ./scripts/... -update

clean:
	rm -f coverage.out

# Bundle multi-file OpenAPI source into a single self-contained YAML.
# Scalar UI tidak handal resolve relative $ref lintas file di browser, jadi
# bundle wajib di-regen tiap kali edit docs/openapi/{paths,schemas,components}.
# Output di-embed ke binary via docs/embed.go (//go:embed).

openapi-bundle:
	npx -y @redocly/cli@latest bundle docs/openapi/openapi.yaml \
		--output docs/openapi/openapi.bundle.yaml --ext yaml

# Lint source spec (multi-file form, sebelum bundle).
openapi-lint:
	npx -y @redocly/cli@latest lint docs/openapi/openapi.yaml \
		--config docs/openapi/redocly.yaml

# CI drift guard: regen bundle, fail kalau hasil beda dari yang di-commit.
openapi-bundle-check: openapi-bundle
	git diff --exit-code -- docs/openapi/openapi.bundle.yaml \
		|| (echo "ERROR: docs/openapi/openapi.bundle.yaml out of sync; run 'make openapi-bundle' and commit" && exit 1)
