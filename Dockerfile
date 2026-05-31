# Build stage
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Install git for downloading some go packages if required
RUN apk add --no-cache git

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
