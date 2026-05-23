<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import type { EChartsCoreOption } from 'echarts/core'

const props = withDefaults(
  defineProps<{
    option?: EChartsCoreOption
    loading?: boolean
    autoresize?: boolean
  }>(),
  { autoresize: true },
)

const safeOption = computed<EChartsCoreOption>(() => props.option ?? { series: [] })
</script>

<template>
  <VChart
    class="h-full w-full"
    :option="safeOption"
    :loading="loading"
    :autoresize="autoresize"
  />
</template>
