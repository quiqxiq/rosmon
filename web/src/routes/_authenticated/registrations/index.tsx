import { createFileRoute } from '@tanstack/react-router'
import { Registrations } from '@/features/registrations'

export const Route = createFileRoute('/_authenticated/registrations/')({
  component: Registrations,
})
