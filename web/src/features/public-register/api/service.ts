import axios, { type AxiosInstance } from 'axios'
import type { Envelope } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import type {
  PublicPackage,
  RegistrationSubmitInput,
  RegistrationSubmitResult,
  ServiceType,
} from './schema'

// A bare client WITHOUT the auth interceptors — these endpoints are public
// and must work for anonymous visitors (no token, no refresh handling).
const rawBase = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'
const publicClient: AxiosInstance = axios.create({
  baseURL: `${rawBase.replace(/\/+$/, '')}/api/v1`,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})

export async function getPublicPackages(
  serviceType?: ServiceType,
): Promise<PublicPackage[]> {
  const res = await publicClient.get<Envelope<PublicPackage[]>>(
    '/public/packages',
  )
  const all = unwrap(res.data)
  return serviceType
    ? all.filter((p) => p.service_type === serviceType)
    : all
}

export async function submitRegistration(
  payload: RegistrationSubmitInput,
): Promise<RegistrationSubmitResult> {
  const res = await publicClient.post<Envelope<RegistrationSubmitResult>>(
    '/public/registrations',
    payload,
  )
  return unwrap(res.data)
}
