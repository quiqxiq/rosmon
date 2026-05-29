import { z } from 'zod'

// Source: internal/services/router_service.go#/RouterPublicView.
// Note: backend strips `password` and `webhook_token` before sending,
// and does NOT include `created_at` / `updated_at` in the public view.

export const RouterStatusSchema = z.enum([
  'unknown',
  'connected',
  'disconnected',
  'error',
])
export type RouterStatus = z.infer<typeof RouterStatusSchema>

export const RouterPublicViewSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  ip_address: z.string(),
  api_port: z.number().int(),
  api_username: z.string(),
  status: RouterStatusSchema,
  last_seen_at: z.string().nullable(),
  notes: z.string().nullable(),
})
export type RouterPublicView = z.infer<typeof RouterPublicViewSchema>

// POST /routers body — see services.CreateRouterRequest. Password is
// required on create and never returned on read; treat as write-only.
export const CreateRouterRequestSchema = z.object({
  name: z.string().min(1).max(100),
  ip_address: z.string().min(1).max(255),
  api_port: z.number().int().min(1).max(65535).optional(),
  api_username: z.string().min(1).max(64),
  password: z.string().min(1).max(128),
  notes: z.string().max(500).optional(),
})
export type CreateRouterRequest = z.infer<typeof CreateRouterRequestSchema>

// PUT /routers/:id body — partial update. Backend re-tests the connection
// when any of ip_address / api_port / api_username / password change, so
// passing a wrong password fails the request server-side.
export const UpdateRouterRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  ip_address: z.string().min(1).max(255).optional(),
  api_port: z.number().int().min(1).max(65535).optional(),
  api_username: z.string().min(1).max(64).optional(),
  password: z.string().min(1).max(128).optional(),
  notes: z.string().max(500).optional(),
})
export type UpdateRouterRequest = z.infer<typeof UpdateRouterRequestSchema>

// POST /routers/:id/test body. Backend allows testing arbitrary creds —
// the path id is required by the router-ownership middleware but the
// stored credentials are NOT used.
export const TestConnectionRequestSchema = z.object({
  ip_address: z.string().min(1),
  api_port: z.number().int().optional(),
  api_username: z.string().min(1),
  password: z.string().min(1),
})
export type TestConnectionRequest = z.infer<typeof TestConnectionRequestSchema>

// Source: internal/services/router_service.go#/ConnectionTestResult.
// `latency_ms` is the dial round-trip; `routeros_version` / `board_model`
// / `identity` come from `/system/identity/print` after the dial succeeds.
export const ConnectionTestResultSchema = z.object({
  connected: z.boolean(),
  latency_ms: z.number().int(),
  routeros_version: z.string(),
  board_model: z.string(),
  identity: z.string(),
  error: z.string().optional(),
})
export type ConnectionTestResult = z.infer<typeof ConnectionTestResultSchema>
