import { type MaybeRefOrGetter, computed, toValue } from 'vue'
import { useEventSource } from '@vueuse/core'

export interface UseSSEOptions {
  withCredentials?: boolean
  autoReconnect?: boolean
  immediate?: boolean
}

export function useSSE<T = unknown>(
  url: MaybeRefOrGetter<string | null | undefined>,
  events: string[] = ['message'],
  options: UseSSEOptions = {},
) {
  const reactiveUrl = computed(() => toValue(url) ?? undefined)
  const { status, data, error, event, close, open } = useEventSource(reactiveUrl, events, {
    withCredentials: options.withCredentials,
    autoReconnect: options.autoReconnect ?? true,
    immediate: options.immediate ?? true,
  })

  const parsed = computed<T | null>(() => {
    if (!data.value) return null
    try {
      return JSON.parse(data.value) as T
    } catch {
      return null
    }
  })

  return { status, data, parsed, error, event, close, open }
}
