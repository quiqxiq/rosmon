import { useMutation } from '@tanstack/react-query'
import { testPaymentGateway } from './service'

export { useSystemSettings, useUpdateSetting } from '../../api/queries'

/** Hook untuk test koneksi payment gateway */
export function useTestPaymentGateway() {
  return useMutation({
    mutationFn: testPaymentGateway,
  })
}
