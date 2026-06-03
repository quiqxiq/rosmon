import { createFileRoute } from '@tanstack/react-router'
import { SettingsBillingConfig } from '@/features/settings/billing-config'

export const Route = createFileRoute('/_authenticated/settings/billing')({
  component: SettingsBillingConfig,
})
