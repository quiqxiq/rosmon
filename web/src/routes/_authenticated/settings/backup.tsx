import { createFileRoute } from '@tanstack/react-router'
import { SettingsBackup } from '@/features/settings/backup'

export const Route = createFileRoute('/_authenticated/settings/backup')({
  component: SettingsBackup,
})
