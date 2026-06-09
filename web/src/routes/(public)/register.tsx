import { createFileRoute } from '@tanstack/react-router'
import { PublicRegister } from '@/features/public-register'

// Public, unauthenticated landing page (outside _authenticated). Visitors
// pick a real package and submit an installation request.
export const Route = createFileRoute('/(public)/register')({
  component: PublicRegister,
})
