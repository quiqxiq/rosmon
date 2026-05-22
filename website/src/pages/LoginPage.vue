<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const username = ref('')
const password = ref('')
const error = ref<string | null>(null)
const loading = ref(false)

const { login } = useAuth()
const route = useRoute()
const router = useRouter()

async function submit() {
  error.value = null
  loading.value = true
  try {
    await login({ username: username.value, password: password.value })
    const redirect = (route.query.redirect as string | undefined) ?? '/overview'
    await router.push(redirect)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form class="space-y-4" @submit.prevent="submit">
    <h2 class="text-xl font-semibold">Sign in</h2>
    <div>
      <label class="mb-1 block text-sm font-medium" for="username">Username</label>
      <input
        id="username"
        v-model="username"
        type="text"
        required
        class="w-full rounded border border-slate-300 px-3 py-2 dark:bg-slate-800"
      />
    </div>
    <div>
      <label class="mb-1 block text-sm font-medium" for="password">Password</label>
      <input
        id="password"
        v-model="password"
        type="password"
        required
        class="w-full rounded border border-slate-300 px-3 py-2 dark:bg-slate-800"
      />
    </div>
    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
    <button
      type="submit"
      :disabled="loading"
      class="w-full rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
    >
      {{ loading ? 'Signing in…' : 'Sign in' }}
    </button>
  </form>
</template>
