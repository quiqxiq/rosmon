<script setup lang="ts">
import { ref } from 'vue'
import { onClickOutside } from '@vueuse/core'
import Icon from '@/components/ui/Icon.vue'
import Segmented from '@/components/ui/Segmented.vue'
import { useTweaks } from '@/composables/useTweaks'
import { PALETTE_PRESETS } from '@/stores/tweaks'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const panelEl = ref<HTMLElement | null>(null)
onClickOutside(panelEl, () => {
  if (props.open) emit('close')
})

const {
  theme,
  density,
  cardStyle,
  sidebarMode,
  chartKind,
  palette,
  setTheme,
  setDensity,
  setCardStyle,
  setSidebarMode,
  setChartKind,
  setPalette,
} = useTweaks()

function pickPalette(p: (typeof PALETTE_PRESETS)[number]) {
  setPalette(p)
}

function isPaletteActive(p: (typeof PALETTE_PRESETS)[number]) {
  return p[0] === palette.value[0] && p[1] === palette.value[1] && p[2] === palette.value[2]
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0" style="z-index: 90">
      <div class="overlay md:hidden" @click="$emit('close')" />
      <div
        ref="panelEl"
        class="absolute card scale-in"
        style="
          right: 12px;
          top: 64px;
          width: 320px;
          max-width: calc(100vw - 24px);
          z-index: 91;
          padding: 16px;
        "
      >
        <header class="mb-3 flex items-center justify-between">
          <h3 class="text-sm font-semibold">Tweaks</h3>
          <button class="btn btn-ghost btn-icon btn-sm" type="button" @click="$emit('close')">
            <Icon name="X" :size="14" />
          </button>
        </header>

        <div class="space-y-4">
          <section>
            <div
              class="mb-2 text-[10px] font-semibold uppercase"
              style="color: var(--muted); letter-spacing: 0.08em"
            >
              Tampilan
            </div>
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3">
                <label class="text-xs" style="color: var(--text-2)">Tema</label>
                <Segmented
                  :model-value="theme"
                  :options="[
                    { value: 'dark', label: 'Dark' },
                    { value: 'light', label: 'Light' },
                  ]"
                  @update:model-value="setTheme"
                />
              </div>
              <div class="flex items-center justify-between gap-3">
                <label class="text-xs" style="color: var(--text-2)">Density</label>
                <Segmented
                  :model-value="density"
                  :options="[
                    { value: 'compact', label: 'Compact' },
                    { value: 'regular', label: 'Regular' },
                    { value: 'comfy', label: 'Comfy' },
                  ]"
                  @update:model-value="setDensity"
                />
              </div>
            </div>
          </section>

          <section>
            <div
              class="mb-2 text-[10px] font-semibold uppercase"
              style="color: var(--muted); letter-spacing: 0.08em"
            >
              Sidebar
            </div>
            <div class="flex items-center justify-between gap-3">
              <label class="text-xs" style="color: var(--text-2)">Mode</label>
              <Segmented
                :model-value="sidebarMode"
                :options="[
                  { value: 'expanded', label: 'Expanded' },
                  { value: 'icon', label: 'Icon' },
                  { value: 'hidden', label: 'Hidden' },
                ]"
                @update:model-value="setSidebarMode"
              />
            </div>
          </section>

          <section>
            <div
              class="mb-2 text-[10px] font-semibold uppercase"
              style="color: var(--muted); letter-spacing: 0.08em"
            >
              Cards & Charts
            </div>
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3">
                <label class="text-xs" style="color: var(--text-2)">Card style</label>
                <Segmented
                  :model-value="cardStyle"
                  :options="[
                    { value: 'flat', label: 'Flat' },
                    { value: 'elevated', label: 'Elevated' },
                    { value: 'bordered', label: 'Bordered' },
                  ]"
                  @update:model-value="setCardStyle"
                />
              </div>
              <div class="flex items-center justify-between gap-3">
                <label class="text-xs" style="color: var(--text-2)">Chart kind</label>
                <Segmented
                  :model-value="chartKind"
                  :options="[
                    { value: 'area', label: 'Area' },
                    { value: 'line', label: 'Line' },
                    { value: 'bar', label: 'Bar' },
                  ]"
                  @update:model-value="setChartKind"
                />
              </div>
            </div>
          </section>

          <section>
            <div
              class="mb-2 text-[10px] font-semibold uppercase"
              style="color: var(--muted); letter-spacing: 0.08em"
            >
              Palette
            </div>
            <div class="grid grid-cols-5 gap-2">
              <button
                v-for="(p, i) in PALETTE_PRESETS"
                :key="i"
                type="button"
                class="relative flex h-10 overflow-hidden rounded-md"
                :style="{
                  border: isPaletteActive(p)
                    ? '2px solid var(--accent-cyan)'
                    : '1px solid var(--border-strong)',
                }"
                @click="pickPalette(p)"
              >
                <span :style="{ flex: 2, background: p[0] }" />
                <span class="flex flex-1 flex-col">
                  <span :style="{ flex: 1, background: p[1] }" />
                  <span :style="{ flex: 1, background: p[2] }" />
                </span>
                <span
                  v-if="isPaletteActive(p)"
                  class="absolute inset-0 flex items-center justify-center"
                  style="color: white; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5)"
                >
                  <Icon name="Check" :size="14" />
                </span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  </Teleport>
</template>
