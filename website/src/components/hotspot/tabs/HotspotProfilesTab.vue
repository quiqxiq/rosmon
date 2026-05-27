<script setup lang="ts">
import { computed, ref } from 'vue'
import Icon from '@/components/ui/Icon.vue'
import Drawer from '@/components/ui/Drawer.vue'
import Field from '@/components/ui/Field.vue'
import Input from '@/components/ui/Input.vue'
import NumberInput from '@/components/ui/NumberInput.vue'
import Select from '@/components/ui/Select.vue'
import Toggle from '@/components/ui/Toggle.vue'
import ConfirmModal from '@/components/ui/ConfirmModal.vue'
import OverviewKpiCard from '@/components/overview/OverviewKpiCard.vue'
import HotspotProfileCard from '@/components/hotspot/HotspotProfileCard.vue'
import HotspotProfileFormModal, {
  type ProfileFormPayload,
} from '@/components/hotspot/HotspotProfileFormModal.vue'
import SyncProfilesSummaryModal from '@/components/hotspot/SyncProfilesSummaryModal.vue'
import SyncConfirmModal from '@/components/hotspot/SyncConfirmModal.vue'
import { fmtRpShort } from '@/utils/fmt'
import { useToast } from '@/composables/useToast'
import { useActiveDevice } from '@/composables/useActiveDevice'
import { useHotspotProfilesQuery } from '@/queries/hotspot.queries'
import {
  useProfileConfigsQuery,
  useUpsertProfileConfigMutation,
  useDeleteProfileConfigMutation,
  useSyncProfilesMutation,
} from '@/queries/profile-config.queries'
import { hotspotProfilesService } from '@/services/hotspot-profiles'
import type { ProfileConfigSyncResponse } from '@/types/profile-config'
import type { ProfileViewModel } from '@/components/hotspot/profile-vm'
import { EXPIRY_MODE_OPTIONS } from '@/components/hotspot/profile-vm'

const toast = useToast()
const { activeDeviceId } = useActiveDevice()

// Query & Mutation Hooks
const { data: apiProfiles, refetch: refetchProfiles, isLoading: loadingProfiles } =
  useHotspotProfilesQuery(activeDeviceId)
const { data: localConfigs, refetch: refetchConfigs } = useProfileConfigsQuery(activeDeviceId)
const upsertMutation = useUpsertProfileConfigMutation(activeDeviceId)
const deleteConfigMutation = useDeleteProfileConfigMutation(activeDeviceId)
const syncMutation = useSyncProfilesMutation(activeDeviceId)

const drawerOpen = ref(false)
const editing = ref<ProfileViewModel | null>(null)
const formOpen = ref(false)
const confirmDelete = ref(false)
const syncModalOpen = ref(false)
const syncResult = ref<ProfileConfigSyncResponse | null>(null)
const confirmSyncOpen = ref(false)

// Merge RouterOS Profiles dengan mikhmon profile_config (DB).
const mergedProfiles = computed<ProfileViewModel[]>(() => {
  const ros = apiProfiles.value ?? []
  const configs = localConfigs.value ?? []
  const configMap = new Map(configs.map((c) => [c.profile_name, c]))
  const colors = ['cyan', 'violet', 'lime'] as const

  return ros.map((p, idx) => {
    const cfg = configMap.get(p.name)
    return {
      id: p.id,
      name: p.name,
      speed: p.rate_limit || 'unlimited',
      validity: cfg?.validity ?? '',
      price: cfg?.price ?? 0,
      sell_price: cfg?.sell_price ?? 0,
      expiry_mode: cfg?.expiry_mode ?? '0',
      lock_mac: cfg?.lock_mac ?? false,
      shared_users: p.shared_users || 1,
      address_pool: p.address_pool || 'none',
      add_mac_cookie: p.add_mac_cookie,
      transparent_proxy: p.transparent_proxy,
      color: colors[idx % colors.length],
      // Placeholder count terjual untuk visual sampai integrasi reports.
      sold: Math.floor((idx + 3) * 7.5) % 80,
      has_config: Boolean(cfg),
    }
  })
})

const maxSold = computed(() => {
  const list = mergedProfiles.value
  return list.length ? Math.max(...list.map((p) => p.sold)) : 100
})

const totalSold = computed(() => mergedProfiles.value.reduce((a, p) => a + p.sold, 0))
const totalRevenue = computed(() =>
  mergedProfiles.value.reduce((a, p) => a + (p.sell_price || p.price) * p.sold, 0),
)
const avgRevenue = computed(() => Math.round(totalRevenue.value / Math.max(1, totalSold.value)))

function openProfile(p: ProfileViewModel) {
  editing.value = { ...p }
  drawerOpen.value = true
}

function openCreate() {
  editing.value = null
  formOpen.value = true
}

async function onCreate(p: ProfileFormPayload) {
  if (!activeDeviceId.value) return
  try {
    // 1. Create standard profile di RouterOS.
    await hotspotProfilesService.create(activeDeviceId.value, {
      name: p.name,
      rate_limit: p.rate_limit || undefined,
      address_pool: p.address_pool || undefined,
      shared_users: p.shared_users,
      status_autorefresh: p.status_autorefresh || undefined,
      parent_queue: p.parent_queue || undefined,
    })

    // 2. Upsert mikhmon local config (auto-inject on-login script di backend).
    await upsertMutation.mutateAsync({
      profile_name: p.name,
      payload: {
        expiry_mode: p.expiry_mode,
        validity: p.validity,
        price: p.price,
        sell_price: p.sell_price,
        lock_mac: p.lock_mac,
      },
    })

    toast.success(`Profile ${p.name} ditambahkan`)
    refetchProfiles()
    refetchConfigs()
    formOpen.value = false
  } catch (err) {
    toast.error(`Gagal membuat profile: ${(err as Error).message || err}`)
  }
}

async function saveDrawer() {
  const p = editing.value
  if (!p || !activeDeviceId.value) return

  // RouterOS update non-blocking: gagal (misal router offline) tidak
  // mencegah config mikhmon tersimpan.
  let rosWarning: string | null = null
  try {
    await hotspotProfilesService.update(activeDeviceId.value, p.id, {
      rate_limit: p.speed,
      shared_users: p.shared_users,
      add_mac_cookie: p.add_mac_cookie,
      transparent_proxy: p.transparent_proxy,
    } as Record<string, unknown>)
  } catch (err) {
    rosWarning = (err as Error).message || 'router tidak bisa dijangkau'
  }

  // Config mikhmon selalu disimpan terlepas dari status router.
  try {
    await upsertMutation.mutateAsync({
      profile_name: p.name,
      payload: {
        expiry_mode: p.expiry_mode,
        validity: p.validity,
        price: p.price,
        sell_price: p.sell_price,
        lock_mac: p.lock_mac,
      },
    })
    if (rosWarning) {
      toast.warning(`Config disimpan. RouterOS tidak terupdate: ${rosWarning}`)
    } else {
      toast.success(`Profile ${p.name} berhasil disimpan`)
    }
    refetchProfiles()
    refetchConfigs()
    drawerOpen.value = false
  } catch (configErr) {
    toast.error(`Gagal simpan config: ${(configErr as Error).message}`)
  }
}

async function doDelete() {
  const p = editing.value
  if (!p || !activeDeviceId.value) return
  try {
    // 1. Hapus profile di RouterOS.
    await hotspotProfilesService.remove(activeDeviceId.value, p.id)
    // 2. Hapus mikhmon profile_config (cascade manual — backend tidak cascade).
    if (p.has_config) {
      try {
        await deleteConfigMutation.mutateAsync(p.name)
      } catch {
        // Non-fatal — config orphan akan tampil saat sync berikutnya.
      }
    }
    toast.warning(`Profile ${p.name} dihapus`)
    refetchProfiles()
    refetchConfigs()
    confirmDelete.value = false
    drawerOpen.value = false
    editing.value = null
  } catch (err) {
    toast.error(`Gagal menghapus profile: ${(err as Error).message || err}`)
  }
}

async function executeSync() {
  if (!activeDeviceId.value) return
  confirmSyncOpen.value = false
  try {
    const result = await syncMutation.mutateAsync()
    syncResult.value = result
    syncModalOpen.value = true
    refetchProfiles()
    refetchConfigs()
  } catch (err) {
    toast.error(`Sync gagal: ${(err as Error).message || err}`)
  }
}
</script>

<template>
  <div>
    <div class="mb-4 flex flex-wrap items-center gap-2">
      <button
        class="btn btn-sm"
        type="button"
        :disabled="syncMutation.isPending.value"
        @click="confirmSyncOpen = true"
      >
        <Icon name="Refresh" :size="13" />
        {{ syncMutation.isPending.value ? 'Syncing…' : 'Sync router' }}
      </button>
      <div class="flex-1" />
      <button class="btn btn-primary btn-sm" type="button" @click="openCreate">
        <Icon name="Plus" :size="14" />
        Tambah Profile
      </button>
    </div>

    <div v-if="loadingProfiles" class="mb-4 flex items-center justify-center p-8">
      <div class="text-sm" style="color: var(--muted)">Loading profiles...</div>
    </div>

    <div v-else>
      <div class="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <OverviewKpiCard
          label="Total Profile"
          :value="mergedProfiles.length"
          delta="Aktif"
          trend="flat"
          icon="Wifi"
          accent="cyan"
        />
        <OverviewKpiCard
          label="Voucher terjual"
          :value="totalSold"
          delta="placeholder"
          trend="up"
          icon="Ticket"
          accent="violet"
        />
        <OverviewKpiCard
          label="Pendapatan kotor"
          :value="fmtRpShort(totalRevenue)"
          delta="estimasi"
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
          v-for="p in mergedProfiles"
          :key="p.name"
          :profile="p"
          :max-sold="maxSold"
          @click="openProfile(p)"
        />
      </div>
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
              <NumberInput v-model="editing.shared_users" :min="1" :max="100" />
            </Field>
            <div
              class="flex items-center justify-between rounded-lg p-3"
              style="background: var(--bg-2)"
            >
              <div>
                <div class="text-sm font-medium">Add MAC Cookie</div>
                <div class="text-xs" style="color: var(--muted)">
                  Simpan MAC cookie untuk auto login
                </div>
              </div>
              <Toggle v-model="editing.add_mac_cookie" />
            </div>
            <div
              class="flex items-center justify-between rounded-lg p-3"
              style="background: var(--bg-2)"
            >
              <div>
                <div class="text-sm font-medium">Transparent Proxy</div>
                <div class="text-xs" style="color: var(--muted)">Aktifkan transparent proxy</div>
              </div>
              <Toggle v-model="editing.transparent_proxy" />
            </div>
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
            <Field label="Expiry mode" required>
              <Select
                v-model="editing.expiry_mode"
                :options="EXPIRY_MODE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))"
              />
            </Field>
            <Field label="Validity" hint="Format RouterOS: 7d, 1w, 30d, 1mo">
              <Input v-model="editing.validity" placeholder="7d" />
            </Field>
            <div class="grid grid-cols-2 gap-3">
              <Field label="Harga modal (Rp)">
                <NumberInput v-model="editing.price" :min="0" :step="500" />
              </Field>
              <Field label="Harga jual (Rp)">
                <NumberInput v-model="editing.sell_price" :min="0" :step="500" />
              </Field>
            </div>
            <div
              class="flex items-center justify-between rounded-lg p-3"
              style="background: var(--bg-2)"
            >
              <div>
                <div class="text-sm font-medium">Lock to MAC</div>
                <div class="text-xs" style="color: var(--muted)">
                  Lock user ke MAC saat login pertama
                </div>
              </div>
              <Toggle v-model="editing.lock_mac" />
            </div>
          </div>
        </section>
      </div>

      <template #footer>
        <button class="btn btn-danger btn-sm" type="button" @click="confirmDelete = true">
          Hapus profile
        </button>
        <div class="flex-1" />
        <button class="btn btn-sm" type="button" @click="drawerOpen = false">Batal</button>
        <button
          class="btn btn-primary btn-sm"
          type="button"
          :disabled="upsertMutation.isPending.value"
          @click="saveDrawer"
        >
          {{ upsertMutation.isPending.value ? 'Menyimpan…' : 'Simpan' }}
        </button>
      </template>
    </Drawer>

    <HotspotProfileFormModal
      :open="formOpen"
      :initial="null"
      @close="formOpen = false"
      @save="onCreate"
    />

    <ConfirmModal
      :open="confirmDelete"
      title="Hapus profile?"
      :message="`Profile ${editing?.name ?? ''} akan dihapus dari router & DB.`"
      confirm-text="Hapus"
      variant="danger"
      @close="confirmDelete = false"
      @confirm="doDelete"
    />

    <SyncConfirmModal
      :open="confirmSyncOpen"
      :router-profile-names="(apiProfiles ?? []).map((p) => p.name)"
      :db-config-names="(localConfigs ?? []).map((c) => c.profile_name)"
      @close="confirmSyncOpen = false"
      @confirm="executeSync"
    />

    <SyncProfilesSummaryModal
      :open="syncModalOpen"
      :result="syncResult"
      @close="syncModalOpen = false"
    />
  </div>
</template>
