<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <div class="flex h-full items-center justify-center bg-slate-100 dark:bg-slate-950">
    <div class="w-full max-w-sm rounded-lg bg-white p-8 shadow-md dark:bg-slate-900">
      <RouterView />
    </div>
  </div>
</template>
