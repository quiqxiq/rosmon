import { createFileRoute } from '@tanstack/react-router'
import { HotspotOverview } from '@/features/hotspot'

export const Route = createFileRoute('/_authenticated/hotspot/')({
  component: HotspotOverview,
})
