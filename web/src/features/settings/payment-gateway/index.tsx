import { ContentSection } from '../components/content-section'
import { PaymentGatewayForm } from './payment-gateway-form'

export function SettingsPaymentGateway() {
  return (
    <ContentSection
      title='Payment Gateway'
      desc='Konfigurasi Xendit untuk menerima pembayaran online dari pelanggan via transfer bank, QRIS, e-wallet, dan kartu kredit.'
    >
      <PaymentGatewayForm />
    </ContentSection>
  )
}
