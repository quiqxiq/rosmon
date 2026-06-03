import { ContentSection } from '../components/content-section'
import { BackupForm } from './backup-form'

export function SettingsBackup() {
  return (
    <ContentSection
      title='Backup'
      desc='Konfigurasi backup otomatis konfigurasi router dan database.'
    >
      <BackupForm />
    </ContentSection>
  )
}
