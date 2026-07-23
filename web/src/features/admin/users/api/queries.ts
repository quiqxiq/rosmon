import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import * as svc from './service'
import type {
  AdminUser,
  CreateAdminUserRequest,
  UpdateAdminUserRequest,
} from './schema'

// ─────────────────── Queries ───────────────────

export function useAdminUsers() {
  return useQuery({
    queryKey: qk.adminUsers(),
    queryFn: () => svc.listAdminUsers(),
  })
}

export function useAdminUser(id: number) {
  return useQuery({
    queryKey: qk.adminUser(id),
    queryFn: () => svc.getAdminUser(id),
    enabled: id > 0,
  })
}

// ─────────────────── Mutations ───────────────────

export function useCreateAdminUser() {
  const qc = useQueryClient()
  return useMutation<AdminUser, Error, CreateAdminUserRequest>({
    mutationFn: (body) => svc.createAdminUser(body),
    onSuccess: (data) => {
      // Seed the single-user cache so navigating to /users/:id after
      // create shows content immediately.
      qc.setQueryData(qk.adminUser(data.id), data)
      qc.invalidateQueries({ queryKey: qk.adminUsers() })
    },
  })
}

export function useUpdateAdminUser() {
  const qc = useQueryClient()
  return useMutation<
    AdminUser,
    Error,
    { id: number; body: UpdateAdminUserRequest }
  >({
    mutationFn: ({ id, body }) => svc.updateAdminUser(id, body),
    onSuccess: (data) => {
      qc.setQueryData(qk.adminUser(data.id), data)
      qc.invalidateQueries({ queryKey: qk.adminUsers() })
    },
  })
}

export function useDeleteAdminUser() {
  const qc = useQueryClient()
  return useMutation<void, Error, number>({
    mutationFn: (id) => svc.deleteAdminUser(id),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: qk.adminUser(id) })
      qc.invalidateQueries({ queryKey: qk.adminUsers() })
    },
  })
}

export function useBatchDeleteAdminUsers() {
  const qc = useQueryClient()
  return useMutation<number, Error, number[]>({
    mutationFn: (ids) => svc.batchDeleteAdminUsers(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.adminUsers() })
    },
  })
}
