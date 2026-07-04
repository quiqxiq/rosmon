import { createFileRoute } from '@tanstack/react-router'
import { SubscriptionsMonitoring } from '@/features/subscriptions/index-monitoring'

export const Route = createFileRoute(
  '/_authenticated/subscriptions/monitoring',
)({
  component: SubscriptionsMonitoring,
})
