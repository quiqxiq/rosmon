<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import Icon from '@/components/ui/Icon.vue'
import Field from '@/components/ui/Field.vue'
import Input from '@/components/ui/Input.vue'
import Select from '@/components/ui/Select.vue'
import Segmented from '@/components/ui/Segmented.vue'
import Badge from '@/components/ui/Badge.vue'
import VoucherCard from '@/components/hotspot/VoucherCard.vue'
import { fmtRp, fmtRpShort } from '@/utils/fmt'
import { downloadCsv, todayStamp } from '@/utils/export'
import { useToast } from '@/composables/useToast'
import { useActiveDevice } from '@/composables/useActiveDevice'
import { useHotspotProfilesQuery } from '@/queries/hotspot.queries'
import { useProfileConfigsQuery } from '@/queries/profile-config.queries'
import { hotspotMiscService } from '@/services/hotspot-misc'
import type { GeneratedVoucher } from '@/types/hotspot'
import VoucherPrintModal from '@/components/hotspot/VoucherPrintModal.vue'

const toast = useToast()
const { activeDeviceId } = useActiveDevice()

// Queries
const { data: apiProfiles, isLoading: loadingProfiles } = useHotspotProfilesQuery(activeDeviceId)
const { data: localConfigs } = useProfileConfigsQuery(activeDeviceId)

// Charset: nilai UI → nilai backend (domain.Charset)
const CHARSET_MAP: Record<string, string> = {
  ALPHA_UPPER: 'upper',
  NUMERIC: 'number',
  ALPHANUM: 'upper_number',
}

// pwdMode UI → user_mode backend
const USER_MODE_MAP: Record<string, 'vc' | 'up'> = {
  same: 'vc',
  random: 'up',
}

const count = ref(25)
const server = ref('all')
const profileName = ref('')
const price = ref(0)
const validity = ref('')
const speed = ref('')
const mode = ref<'random' | 'prefix'>('random')
const prefix = ref('VC')
const charLen = ref(6)
const charset = ref('ALPHA_UPPER')
const comment = ref('')
const generating = ref(false)
const view = ref<'mini' | 'standar' | 'list'>('standar')
const printModalOpen = ref(false)
const pwdMode = ref<'same' | 'random'>('same')

// Merge standard RouterOS profiles dengan Mikhmon configs (harga/validity).
// Key by profile_name (sebelumnya `profile`).
const mergedProfiles = computed(() => {
  const ros = apiProfiles.value ?? []
  const configs = localConfigs.value ?? []
  const configMap = new Map(configs.map((c) => [c.profile_name, c]))
  return ros.map((p) => {
    const config = configMap.get(p.name)
    return {
      name: p.name,
      speed: p.rate_limit || 'unlimited',
      validity: config?.validity || '1d',
      // Pakai sell_price kalau ada, fallback ke price (modal). Kalau belum
      // ada config sama sekali → 0 (operator bisa edit manual di form).
      price: config?.sell_price || config?.price || 0,
    }
  })
})

const currentProfile = computed(() => {
  return mergedProfiles.value.find((p) => p.name === profileName.value) || {
    name: 'default',
    speed: 'unlimited',
    validity: '1d',
    price: 0,
  }
})

watch(mergedProfiles, (list) => {
  if (list.length && !profileName.value) {
    chooseProfile(list[0].name)
  }
})

const estimatedRevenue = computed(() => price.value * count.value)

interface Voucher {
  code: string
  password: string
  profile: string
  price: number
  speed: string
  validity: string
  userMode: 'vc' | 'up'
}

const result = ref<Voucher[] | null>(null)

// Computed untuk pass ke VoucherPrintModal
const generatedForPrint = computed<GeneratedVoucher[]>(() =>
  result.value?.map((v) => ({ id: '', username: v.code, password: v.password })) ?? [],
)
const currentUserMode = computed<'vc' | 'up'>(() => USER_MODE_MAP[pwdMode.value] ?? 'vc')

function chooseProfile(name: string) {
  profileName.value = name
  const p = mergedProfiles.value.find((x) => x.name === name)
  if (p) {
    price.value = p.price
    validity.value = p.validity
    speed.value = p.speed
  }
}

async function generate() {
  if (!activeDeviceId.value || !profileName.value) {
    toast.error('Silakan pilih profile hotspot terlebih dahulu')
    return
  }
  generating.value = true
  try {
    const userMode = USER_MODE_MAP[pwdMode.value] ?? 'vc'
    const res = await hotspotMiscService.generateVouchers(activeDeviceId.value, {
      batch_size: count.value,
      profile: profileName.value,
      charset: CHARSET_MAP[charset.value] ?? charset.value,
      length: charLen.value,
      user_mode: userMode,
      prefix: mode.value === 'prefix' ? prefix.value : undefined,
      validity: validity.value || undefined,
      price: price.value || undefined,
      comment: comment.value || undefined,
      server: server.value !== 'all' ? server.value : undefined,
    })

    result.value = res.vouchers.map((v) => ({
      code: v.username,
      password: v.password,
      profile: profileName.value,
      price: price.value,
      speed: speed.value,
      validity: validity.value,
      userMode,
    }))

    if (res.partial) {
      toast.warning(`${res.count} dari ${count.value} voucher berhasil (${res.error})`)
    } else {
      toast.success(`${res.count} voucher berhasil di-generate!`)
    }
  } catch (err) {
    toast.error(`Gagal men-generate voucher: ${(err as Error).message || err}`)
  } finally {
    generating.value = false
  }
}

function reset() {
  result.value = null
}

async function copyAll() {
  if (!result.value?.length) return
  const text = result.value.map((v) => `${v.code} / ${v.password}`).join('\n')
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${result.value.length} voucher disalin ke clipboard`)
  } catch {
    toast.error('Gagal menyalin ke clipboard')
  }
}

function downloadCsvVouchers() {
  if (!result.value?.length) {
    toast.warning('Tidak ada voucher untuk di-export')
    return
  }
  downloadCsv(
    result.value.map((v, i) => ({
      no: i + 1,
      code: v.code,
      password: v.password,
      profile: v.profile,
      validity: v.validity,
      price: v.price,
    })),
    `vouchers-${todayStamp()}.csv`,
  )
  toast.success(`${result.value.length} voucher di-export ke CSV`)
}

async function copyOne(code: string, password: string) {
  try {
    await navigator.clipboard.writeText(`${code} / ${password}`)
    toast.success('Voucher disalin ke clipboard')
  } catch {
    toast.error('Gagal menyalin')
  }
}
</script>

<template>
  <div class="fade-in">
    <PageHeader
      title="Voucher Generator"
      subtitle="Buat batch voucher hotspot dengan format custom"
    >
      <template v-if="result" #right>
        <Badge tone="success" dot>{{ result.length }} voucher berhasil dibuat</Badge>
        <button class="btn btn-sm" type="button" @click="copyAll">
          <Icon name="Copy" :size="13" />
          Salin semua
        </button>
        <button class="btn btn-sm" type="button" @click="downloadCsvVouchers">
          <Icon name="Download" :size="13" />
          CSV
        </button>
        <button class="btn btn-sm" type="button" @click="printModalOpen = true">
          <Icon name="Print" :size="13" />
          Cetak
        </button>
        <button class="btn btn-primary btn-sm" type="button" @click="reset">Batch baru</button>
      </template>
    </PageHeader>

    <div v-if="loadingProfiles" class="mb-4 flex items-center justify-center p-8">
      <div class="text-sm" style="color: var(--muted)">Loading hotspot profiles...</div>
    </div>

    <!-- Pre-generate state -->
    <div v-else-if="!result" class="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
      <div class="card space-y-5">
        <section>
          <h3
            class="mb-3 text-[10px] font-semibold uppercase"
            style="color: var(--muted); letter-spacing: 0.08em"
          >
            1. Quantity & Profile
          </h3>
          <div class="grid gap-3 sm:grid-cols-2">
            <Field label="Jumlah voucher" required>
              <div class="flex items-center gap-2">
                <Input v-model="count" type="number" />
                <div class="flex gap-1">
                  <button
                    v-for="q in [10, 25, 50, 100]"
                    :key="q"
                    class="btn btn-xs"
                    type="button"
                    @click="count = q"
                  >
                    {{ q }}
                  </button>
                </div>
              </div>
            </Field>
            <Field label="Server">
              <Select
                v-model="server"
                :options="[
                  { value: 'all', label: 'all' },
                  { value: 'hotspot1', label: 'hotspot1' },
                  { value: 'hotspot2', label: 'hotspot2' },
                ]"
              />
            </Field>
          </div>
          <div class="mt-3">
            <Field label="Profile">
              <Select
                :model-value="profileName"
                :options="mergedProfiles.map((p) => ({
                  value: p.name,
                  label: `${p.name}  —  ${p.speed} · ${p.validity} · ${fmtRpShort(p.price)}`,
                }))"
                @update:model-value="chooseProfile($event)"
              />
            </Field>
          </div>
          <div class="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Harga jual (Rp)">
              <Input v-model="price" type="number" />
            </Field>
            <Field label="Validity">
              <Input v-model="validity" />
            </Field>
          </div>
        </section>

        <section>
          <h3
            class="mb-3 text-[10px] font-semibold uppercase"
            style="color: var(--muted); letter-spacing: 0.08em"
          >
            2. Format Username & Password
          </h3>
          <div class="space-y-3">
            <Field label="Mode username">
              <Segmented
                v-model="mode"
                :options="[
                  { value: 'random', label: 'Random' },
                  { value: 'prefix', label: 'Prefix+Random' },
                ]"
              />
            </Field>
            <Field v-if="mode === 'prefix'" label="Prefix">
              <Input v-model="prefix" />
            </Field>
            <Field :label="`Panjang karakter · ${charLen}`">
              <input
                v-model.number="charLen"
                type="range"
                min="4"
                max="12"
                step="1"
                class="w-full"
              />
            </Field>
            <Field label="Charset">
              <Select
                v-model="charset"
                :options="[
                  { value: 'ALPHA_UPPER', label: 'Huruf Besar (A-Z)' },
                  { value: 'NUMERIC', label: 'Angka (0-9)' },
                  { value: 'ALPHANUM', label: 'Huruf Besar + Angka' },
                ]"
              />
            </Field>
            <Field label="Mode password">
              <Segmented
                v-model="pwdMode"
                :options="[
                  { value: 'same', label: 'Voucher Code (user = pass)' },
                  { value: 'random', label: 'User + Password Berbeda' },
                ]"
              />
            </Field>
          </div>
        </section>

        <section>
          <h3
            class="mb-3 text-[10px] font-semibold uppercase"
            style="color: var(--muted); letter-spacing: 0.08em"
          >
            3. Komentar
          </h3>
          <Field label="Catatan batch (opsional)">
            <Input v-model="comment" placeholder="Misal: batch tgl 21 Mei" />
          </Field>
        </section>

        <div
          class="flex items-center justify-between rounded-lg p-4"
          style="background: var(--bg-2)"
        >
          <div class="text-xs" style="color: var(--muted)">
            Estimasi pemasukan:
            <span class="ml-1 font-semibold text-base" style="color: var(--text)">{{
              fmtRp(estimatedRevenue)
            }}</span>
          </div>
          <button class="btn btn-violet" type="button" :disabled="generating" @click="generate">
            <Icon name="Sparkles" :size="14" />
            {{ generating ? 'Membuat...' : `Generate ${count} voucher` }}
          </button>
        </div>
      </div>

      <div class="space-y-4">
        <div class="card">
          <div
            class="mb-3 text-[10px] font-semibold uppercase"
            style="color: var(--muted); letter-spacing: 0.08em"
          >
            Preview Voucher
          </div>
          <VoucherCard
            code="XYZ4-5T"
            password="9k2m"
            :profile="currentProfile.name"
            :speed="currentProfile.speed"
            :price="price"
          />
        </div>
      </div>
    </div>

    <!-- Post-generate state -->
    <div v-else class="space-y-4">
      <div
        class="card flex flex-wrap items-center justify-between gap-3"
        style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3)"
      >
        <div class="flex items-center gap-3">
          <div
            class="flex h-10 w-10 items-center justify-center rounded-full"
            style="background: var(--success); color: white"
          >
            <Icon name="Check" :size="20" />
          </div>
          <div>
            <div class="text-sm font-semibold" style="color: var(--success)">
              {{ result.length }} voucher berhasil dibuat
            </div>
            <div class="text-xs" style="color: var(--muted)">
              Estimasi pendapatan {{ fmtRp(result.length * price) }}
            </div>
          </div>
        </div>
        <Segmented
          v-model="view"
          :options="[
            { value: 'mini', label: 'Mini' },
            { value: 'standar', label: 'Standar' },
            { value: 'list', label: 'List' },
          ]"
        />
      </div>

      <div v-if="view === 'list'" class="card overflow-hidden p-0">
        <table class="tbl">
          <thead>
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>Password</th>
              <th>Profile</th>
              <th>Validity</th>
              <th>Harga</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(v, i) in result" :key="v.code">
              <td class="mono">{{ String(i + 1).padStart(3, '0') }}</td>
              <td class="mono font-semibold">{{ v.code }}</td>
              <td class="mono">{{ v.password }}</td>
              <td>
                <Badge tone="cyan">{{ v.profile }}</Badge>
              </td>
              <td class="mono">{{ v.validity }}</td>
              <td class="mono">{{ fmtRpShort(v.price) }}</td>
              <td>
                <button
                  class="btn btn-ghost btn-icon btn-xs"
                  type="button"
                  @click="copyOne(v.code, v.password)"
                >
                  <Icon name="Copy" :size="12" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div
        v-else
        class="grid gap-3"
        :class="
          view === 'mini'
            ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'
            : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
        "
      >
        <VoucherCard
          v-for="v in result"
          :key="v.code"
          :code="v.code"
          :password="v.password"
          :profile="v.profile"
          :speed="v.speed"
          :price="v.price"
          :variant="view"
        />
      </div>
    </div>
    <VoucherPrintModal
      :open="printModalOpen"
      :generated-vouchers="generatedForPrint"
      :generated-mode="currentUserMode"
      :generated-validity="validity"
      :generated-price="price"
      @close="printModalOpen = false"
    />
  </div>
</template>
