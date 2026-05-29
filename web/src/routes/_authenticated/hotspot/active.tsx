import { createFileRoute } from '@tanstack/react-router'
import { HotspotActive } from '@/features/hotspot/active'

export const Route = createFileRoute('/_authenticated/hotspot/active')({
  component: HotspotActive,
})
