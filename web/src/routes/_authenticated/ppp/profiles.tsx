import { createFileRoute } from '@tanstack/react-router'
import { PPPProfiles } from '@/features/ppp/profiles'

export const Route = createFileRoute('/_authenticated/ppp/profiles')({
  component: PPPProfiles,
})
