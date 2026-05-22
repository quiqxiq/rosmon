import { QueryClient, VueQueryPlugin, type VueQueryPluginOptions } from '@tanstack/vue-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})

export const vueQueryPluginOptions: VueQueryPluginOptions = {
  queryClient,
}

export { VueQueryPlugin }
