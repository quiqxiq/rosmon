import { ref } from 'vue'

export type ToastKind = 'info' | 'success' | 'warning' | 'error'

export interface Toast {
  id: number
  kind: ToastKind
  message: string
  timeout?: number
}

const toasts = ref<Toast[]>([])
let counter = 0

export function useToast() {
  function push(kind: ToastKind, message: string, timeout = 4000) {
    const id = ++counter
    toasts.value.push({ id, kind, message, timeout })
    if (timeout > 0) {
      window.setTimeout(() => dismiss(id), timeout)
    }
    return id
  }
  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }
  return {
    toasts,
    info: (m: string) => push('info', m),
    success: (m: string) => push('success', m),
    warning: (m: string) => push('warning', m),
    error: (m: string) => push('error', m),
    dismiss,
  }
}
