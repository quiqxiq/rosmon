import { ref, type Ref } from 'vue'

export interface LiveSeriesAPI {
  data: Ref<number[]>
  pushPoint: (value: number) => void
  reset: () => void
}

export function useLiveSeries(windowSize = 60, initial: number[] = []): LiveSeriesAPI {
  const safeInitial = initial ?? []
  const seed = safeInitial.length
    ? safeInitial.slice(-windowSize)
    : Array.from({ length: windowSize }, () => 0)
  const data = ref<number[]>(seed)

  function pushPoint(value: number) {
    const next = [...data.value, value]
    if (next.length > windowSize) next.splice(0, next.length - windowSize)
    data.value = next
  }

  function reset() {
    data.value = Array.from({ length: windowSize }, () => 0)
  }

  return { data, pushPoint, reset }
}
