<script setup lang="ts">
import VChart from 'vue-echarts'
import type { EChartsCoreOption } from 'echarts/core'

defineProps<{
  option: EChartsCoreOption
  loading?: boolean
  autoresize?: boolean
}>()
</script>

<template>
  <VChart
    class="h-full w-full"
    :option="option"
    :loading="loading"
    :autoresize="autoresize ?? true"
  />
</template>
