import { createFileRoute, redirect } from '@tanstack/react-router'

// Route lama /admin/whatsapp diarahkan ke /settings/whatsapp.
export const Route = createFileRoute('/_authenticated/admin/whatsapp/')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/whatsapp', replace: true })
  },
})
