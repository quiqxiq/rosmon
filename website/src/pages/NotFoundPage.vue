<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="text-center">
    <h1 class="text-3xl font-bold">404</h1>
    <p class="mt-2 text-sm text-slate-500">Halaman tidak ditemukan.</p>
    <RouterLink to="/overview" class="mt-4 inline-block text-sm text-blue-600 hover:underline">
      Kembali ke Overview
    </RouterLink>
  </div>
</template>
