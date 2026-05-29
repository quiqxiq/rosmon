import { createFileRoute } from '@tanstack/react-router'
import { HotspotHosts } from '@/features/hotspot/hosts'

export const Route = createFileRoute('/_authenticated/hotspot/hosts')({
  component: HotspotHosts,
})
