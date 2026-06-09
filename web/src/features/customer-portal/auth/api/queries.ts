import { useMutation } from '@tanstack/react-query'
import { customerLogin } from './service'

export function useCustomerLogin() {
  return useMutation({
    mutationFn: customerLogin,
  })
}
