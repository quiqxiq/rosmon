import { createFileRoute } from '@tanstack/react-router'
import { HotspotBilling } from '@/features/hotspot/billing'

export const Route = createFileRoute('/_authenticated/hotspot/billing')({
  component: HotspotBilling,
})
