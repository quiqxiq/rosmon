import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { routes } from './routes'

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  const requiresAuth = to.matched.some((r) => r.meta.auth === true)
  const disallowsAuth = to.matched.some((r) => r.meta.auth === false)

  if (requiresAuth && !auth.accessToken) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (disallowsAuth && auth.accessToken) {
    return { name: 'overview' }
  }
  return true
})
