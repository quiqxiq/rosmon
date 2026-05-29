import { createFileRoute } from '@tanstack/react-router'
import { HotspotUsers } from '@/features/hotspot/users'

export const Route = createFileRoute('/_authenticated/hotspot/users')({
  component: HotspotUsers,
})
