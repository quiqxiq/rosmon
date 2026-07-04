import { createFileRoute, redirect } from '@tanstack/react-router'

// Route lama /settings/notification-config diarahkan ke /settings/whatsapp.
export const Route = createFileRoute('/_authenticated/settings/notification-config')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/whatsapp', replace: true })
  },
})
