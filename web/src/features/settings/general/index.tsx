import { ContentSection } from '../components/content-section'
import { GeneralForm } from './general-form'

export function SettingsGeneral() {
  return (
    <ContentSection
      title='Umum'
      desc='Informasi dasar perusahaan dan identitas ISP.'
    >
      <GeneralForm />
    </ContentSection>
  )
}
