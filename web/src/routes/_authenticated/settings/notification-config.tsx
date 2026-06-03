import { createFileRoute } from '@tanstack/react-router'
import { SettingsNotificationConfig } from '@/features/settings/notification-config'

export const Route = createFileRoute(
  '/_authenticated/settings/notification-config',
)({
  component: SettingsNotificationConfig,
})
