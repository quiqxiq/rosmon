import { ContentSection } from '../components/content-section'
import { NotificationConfigForm } from './notification-config-form'

export function SettingsNotificationConfig() {
  return (
    <ContentSection
      title='WhatsApp & Telegram'
      desc='Konfigurasi notifikasi otomatis via WhatsApp dan Telegram Bot.'
    >
      <NotificationConfigForm />
    </ContentSection>
  )
}
