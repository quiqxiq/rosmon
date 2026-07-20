# Build stage
FROM golang:1.23-alpine AS builder

WORKDIR /app

# Install git and curl (needed for toolchain download)
RUN apk add --no-cache git curl

# Allow Go to auto-download the toolchain version required by go.mod (1.26.x)
ENV GOTOOLCHAIN=auto

# Copy dependency manifests
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the Go API server binary
RUN CGO_ENABLED=0 GOOS=linux go build -o rosmon ./cmd/server

# Run stage
FROM alpine:3.19

WORKDIR /app

# Install curl and certificates for healthchecks and external calls (like WhatsMeow or Go-WA)
RUN apk add --no-cache curl ca-certificates

# Copy the pre-built binary
COPY --from=builder /app/rosmon .

# Expose HTTP port
EXPOSE 8080

ENTRYPOINT ["./rosmon"]
