import { ContentSection } from '../components/content-section'
import { BillingConfigForm } from './billing-config-form'

export function SettingsBillingConfig() {
  return (
    <ContentSection
      title='Konfigurasi Billing'
      desc='Aturan penagihan, jatuh tempo, dan kebijakan isolir pelanggan.'
    >
      <BillingConfigForm />
    </ContentSection>
  )
}
