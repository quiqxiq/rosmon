import { createFileRoute } from '@tanstack/react-router'
import { PPPSecrets } from '@/features/ppp/secrets'

export const Route = createFileRoute('/_authenticated/ppp/secrets')({
  component: PPPSecrets,
})
