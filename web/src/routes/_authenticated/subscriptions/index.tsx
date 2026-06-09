import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Subscriptions } from '@/features/subscriptions'

const subscriptionsSearchSchema = z.object({
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(10),
  status: z
    .array(
      z.union([
        z.literal('active'),
        z.literal('pending_install'),
        z.literal('isolir'),
        z.literal('suspended'),
        z.literal('terminated'),
      ])
    )
    .optional()
    .catch([]),
  service_type: z
    .array(z.union([z.literal('pppoe'), z.literal('hotspot')]))
    .optional()
    .catch([]),
  mikrotik_username: z.string().optional().catch(''),
})

export const Route = createFileRoute('/_authenticated/subscriptions/')({
  validateSearch: subscriptionsSearchSchema,
  component: Subscriptions,
})
