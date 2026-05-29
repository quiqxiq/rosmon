import { z } from 'zod'

export const SystemIdentitySchema = z.object({ name: z.string() })
export type SystemIdentity = z.infer<typeof SystemIdentitySchema>

export const SystemResourceSchema = z
  .object({
    uptime: z.string().optional(),
    version: z.string().optional(),
    board_name: z.string().optional(),
    platform: z.string().optional(),
    cpu: z.string().optional(),
    cpu_count: z.number().optional(),
    cpu_load: z.number(),
    free_memory: z.number(),
    total_memory: z.number(),
    free_hdd_space: z.number(),
    total_hdd_space: z.number(),
    architecture_name: z.string().optional(),
  })
  .passthrough()
export type SystemResource = z.infer<typeof SystemResourceSchema>

export const SystemRouterboardSchema = z
  .object({
    routerboard: z.boolean(),
    model: z.string().optional(),
    board_name: z.string().optional(),
    serial_number: z.string().optional(),
    current_firmware: z.string().optional(),
    upgrade_firmware: z.string().optional(),
  })
  .passthrough()
export type SystemRouterboard = z.infer<typeof SystemRouterboardSchema>

export const SystemClockSchema = z
  .object({
    time: z.string().optional(),
    date: z.string().optional(),
    time_zone_name: z.string().optional(),
    gmt_offset: z.string().optional(),
  })
  .passthrough()
export type SystemClock = z.infer<typeof SystemClockSchema>

export const SystemLicenseSchema = z
  .object({
    software_id: z.string().optional(),
    n_level: z.string().optional(),
    features: z.string().optional(),
  })
  .passthrough()
export type SystemLicense = z.infer<typeof SystemLicenseSchema>

export const ScriptSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    owner: z.string().optional(),
    source: z.string().optional(),
    comment: z.string().optional(),
    policy: z.string().optional(),
    run_count: z.number(),
    last_started: z.string().optional(),
  })
  .passthrough()
export type Script = z.infer<typeof ScriptSchema>

export type ScriptCreateInput = {
  name: string
  source: string
  comment?: string
  policy?: string
}

export const SchedulerSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    start_time: z.string().optional(),
    interval: z.string().optional(),
    next_run: z.string().optional(),
    on_event: z.string().optional(),
    disabled: z.boolean(),
    comment: z.string().optional(),
    run_count: z.number(),
  })
  .passthrough()
export type Scheduler = z.infer<typeof SchedulerSchema>

export type SchedulerCreateInput = {
  name: string
  on_event?: string
  start_time?: string
  interval?: string
  comment?: string
}
