<script setup lang="ts">
import { RouterView } from 'vue-router'
import { useTweaks } from '@/composables/useTweaks'

// Side-effect: sync DOM data attributes + CSS variables from tweaks store
useTweaks()
</script>

<template>
  <RouterView />
</template>
