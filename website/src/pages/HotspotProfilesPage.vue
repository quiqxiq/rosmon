<script setup lang="ts">
import { computed, ref } from 'vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import Icon from '@/components/ui/Icon.vue'
import Drawer from '@/components/ui/Drawer.vue'
import Field from '@/components/ui/Field.vue'
import Input from '@/components/ui/Input.vue'
import Toggle from '@/components/ui/Toggle.vue'
import Select from '@/components/ui/Select.vue'
import OverviewKpiCard from '@/components/overview/OverviewKpiCard.vue'
import HotspotProfileCard from '@/components/hotspot/HotspotProfileCard.vue'
import { HS_PROFILES, type FixtureHotspotProfile } from '@/fixtures/hotspot'
import { fmtRpShort } from '@/utils/fmt'

const profiles = ref<FixtureHotspotProfile[]>([...HS_PROFILES])
const drawerOpen = ref(false)
const editing = ref<FixtureHotspotProfile | null>(null)
const maxSold = computed(() => Math.max(...profiles.value.map((p) => p.sold)))

const totalSold = computed(() => profiles.value.reduce((a, p) => a + p.sold, 0))
const totalRevenue = computed(() => profiles.value.reduce((a, p) => a + p.price * p.sold, 0))
const avgRevenue = computed(() => Math.round(totalRevenue.value / Math.max(1, totalSold.value)))

function openProfile(p: FixtureHotspotProfile) {
  editing.value = { ...p }
  drawerOpen.value = true
}
</script>

<template>
  <div class="fade-in">
    <PageHeader
      title="Hotspot Profiles"
      subtitle="Profile berisi tarif, validity, speed limit. Sync ke Mikhmon."
    >
      <template #right>
        <button class="btn btn-sm" type="button">
          <Icon name="Refresh" :size="13" />
          Sync router
        </button>
        <button class="btn btn-primary btn-sm" type="button">
          <Icon name="Plus" :size="14" />
          Tambah Profile
        </button>
      </template>
    </PageHeader>

    <div class="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <OverviewKpiCard
        label="Total Profile"
        :value="profiles.length"
        delta="Aktif"
        trend="flat"
        icon="Wifi"
        accent="cyan"
      />
      <OverviewKpiCard
        label="Voucher terjual"
        :value="totalSold"
        delta="+12.4% MoM"
        trend="up"
        icon="Ticket"
        accent="violet"
      />
      <OverviewKpiCard
        label="Pendapatan kotor"
        :value="fmtRpShort(totalRevenue)"
        delta="bulan ini"
        trend="up"
        icon="Report"
        accent="lime"
      />
      <OverviewKpiCard
        label="Avg per voucher"
        :value="fmtRpShort(avgRevenue)"
        delta="sweet-spot"
        trend="flat"
        icon="Sparkles"
        accent="cyan"
      />
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <HotspotProfileCard
        v-for="p in profiles"
        :key="p.name"
        :profile="p"
        :max-sold="maxSold"
        @click="openProfile(p)"
      />
    </div>

    <Drawer
      :open="drawerOpen"
      :title="editing ? `Profile · ${editing.name}` : 'Profile'"
      @close="drawerOpen = false"
    >
      <div v-if="editing" class="space-y-4">
        <section>
          <h3
            class="mb-2 text-[10px] font-semibold uppercase"
            style="color: var(--muted); letter-spacing: 0.08em"
          >
            Router Profile
          </h3>
          <div class="space-y-3">
            <Field label="Rate Limit">
              <Input v-model="editing.speed" />
            </Field>
            <Field label="Shared Users">
              <Input :model-value="1" type="number" />
            </Field>
            <Field label="Address Pool">
              <Select
                :model-value="'pool-hotspot'"
                :options="[{ value: 'pool-hotspot', label: 'pool-hotspot' }]"
              />
            </Field>
          </div>
        </section>

        <section>
          <h3
            class="mb-2 text-[10px] font-semibold uppercase"
            style="color: var(--muted); letter-spacing: 0.08em"
          >
            Mikhmon Config
          </h3>
          <div class="space-y-3">
            <Field label="Harga jual (Rp)">
              <Input v-model="editing.price" type="number" />
            </Field>
            <Field label="Validity">
              <Input v-model="editing.validity" />
            </Field>
            <Field label="Expiry Mode">
              <Select
                :model-value="'notice'"
                :options="[
                  { value: 'notice', label: 'Show notice' },
                  { value: 'disable', label: 'Auto-disable' },
                  { value: 'delete', label: 'Auto-delete' },
                ]"
              />
            </Field>
            <div class="flex items-center justify-between rounded-lg p-3" style="background: var(--bg-2)">
              <div>
                <div class="text-sm font-medium">Lock to MAC</div>
                <div class="text-xs" style="color: var(--muted)">Voucher hanya bisa dipakai 1 device</div>
              </div>
              <Toggle :model-value="false" />
            </div>
          </div>
        </section>
      </div>

      <template #footer>
        <button class="btn btn-danger btn-sm" type="button">Hapus profile</button>
        <div class="flex-1" />
        <button class="btn btn-sm" type="button" @click="drawerOpen = false">Batal</button>
        <button class="btn btn-primary btn-sm" type="button" @click="drawerOpen = false">Simpan</button>
      </template>
    </Drawer>
  </div>
</template>
