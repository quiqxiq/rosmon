import { createFileRoute } from '@tanstack/react-router'
import { HotspotProfiles } from '@/features/hotspot/profiles'

export const Route = createFileRoute('/_authenticated/hotspot/profiles')({
  component: HotspotProfiles,
})
