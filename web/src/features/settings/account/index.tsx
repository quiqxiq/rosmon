import { ContentSection } from '../components/content-section'
import { AccountForm } from './account-form'

export function SettingsAccount() {
  return (
    <ContentSection
      title='Akun'
      desc='Perbarui informasi akun Anda. Ubah email atau ganti password.'
    >
      <AccountForm />
    </ContentSection>
  )
}
