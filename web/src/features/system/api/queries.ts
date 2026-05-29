import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import * as svc from './service'
import type { SchedulerCreateInput, ScriptCreateInput } from './schema'

export function useSystemIdentity(rid: number) {
  return useQuery({
    queryKey: qk.systemIdentity(rid),
    queryFn: () => svc.getIdentity(rid),
    enabled: rid > 0,
  })
}

export function useSystemResource(rid: number) {
  return useQuery({
    queryKey: qk.systemResource(rid),
    queryFn: () => svc.getResource(rid),
    enabled: rid > 0,
    refetchInterval: 5000,
  })
}

export function useSystemRouterboard(rid: number) {
  return useQuery({
    queryKey: qk.routerboard(rid),
    queryFn: () => svc.getRouterboard(rid),
    enabled: rid > 0,
  })
}

export function useSystemClock(rid: number) {
  return useQuery({
    queryKey: qk.systemClock(rid),
    queryFn: () => svc.getClock(rid),
    enabled: rid > 0,
  })
}

export function useSystemLicense(rid: number) {
  return useQuery({
    queryKey: qk.systemLicense(rid),
    queryFn: () => svc.getLicense(rid),
    enabled: rid > 0,
  })
}

export function useReboot(rid: number) {
  return useMutation({ mutationFn: () => svc.reboot(rid) })
}

export function useShutdown(rid: number) {
  return useMutation({ mutationFn: () => svc.shutdown(rid) })
}

// ── Scripts ──
export function useScripts(rid: number) {
  return useQuery({
    queryKey: qk.scripts(rid),
    queryFn: () => svc.listScripts(rid),
    enabled: rid > 0,
  })
}

export function useCreateScript(rid: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: ScriptCreateInput) => svc.createScript(rid, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.scripts(rid) }),
  })
}

export function useDeleteScript(rid: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => svc.deleteScript(rid, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.scripts(rid) }),
  })
}

// ── Schedulers ──
export function useSchedulers(rid: number) {
  return useQuery({
    queryKey: qk.schedulers(rid),
    queryFn: () => svc.listSchedulers(rid),
    enabled: rid > 0,
  })
}

export function useCreateScheduler(rid: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: SchedulerCreateInput) =>
      svc.createScheduler(rid, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.schedulers(rid) }),
  })
}

export function useDeleteScheduler(rid: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => svc.deleteScheduler(rid, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.schedulers(rid) }),
  })
}
