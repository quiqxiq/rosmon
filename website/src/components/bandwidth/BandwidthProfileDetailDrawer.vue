<script setup lang="ts">
import Drawer from '@/components/ui/Drawer.vue'
import Badge from '@/components/ui/Badge.vue'
import Icon from '@/components/ui/Icon.vue'
import type { BandwidthProfile } from '@/types/bandwidth-profile'
import { fmtRp, fmtDateTime } from '@/utils/fmt'

defineProps<{
  open: boolean
  profile: BandwidthProfile | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'edit', p: BandwidthProfile): void
  (e: 'delete', p: BandwidthProfile): void
}>()
</script>

<template>
  <Drawer :open="open" :title="profile ? profile.name : 'Detail Paket'" @close="emit('close')">
    <div v-if="profile" class="space-y-5">
      <section>
        <h3
          class="mb-2 text-[10px] font-semibold uppercase"
          style="color: var(--muted); letter-spacing: 0.08em"
        >
          Identitas
        </h3>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span style="color: var(--muted)">Tipe layanan</span>
            <Badge :tone="profile.service_type === 'pppoe' ? 'violet' : 'cyan'">
              {{ profile.service_type.toUpperCase() }}
            </Badge>
          </div>
          <div class="flex justify-between">
            <span style="color: var(--muted)">Nama profil MikroTik</span>
            <span class="mono text-[12px]">{{ profile.mikrotik_profile_name }}</span>
          </div>
          <div v-if="profile.description" class="pt-2" style="border-top: 1px solid var(--border)">
            <span style="color: var(--muted)">Keterangan</span>
            <p class="mt-1 text-sm">{{ profile.description }}</p>
          </div>
        </div>
      </section>

      <section>
        <h3
          class="mb-2 text-[10px] font-semibold uppercase"
          style="color: var(--muted); letter-spacing: 0.08em"
        >
          Konfigurasi Router
        </h3>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span style="color: var(--muted)">Rate limit</span>
            <span class="mono text-[12px]">{{ profile.rate_limit || 'unlimited' }}</span>
          </div>
          <div v-if="profile.parent_queue" class="flex justify-between">
            <span style="color: var(--muted)">Parent queue</span>
            <span class="mono text-[12px]">{{ profile.parent_queue }}</span>
          </div>

          <template v-if="profile.service_type === 'pppoe'">
            <div class="pt-2" style="border-top: 1px solid var(--border)">
              <div
                class="mb-1 text-[10px] font-semibold uppercase"
                style="color: var(--muted); letter-spacing: 0.08em"
              >
                PPPoE
              </div>
              <div class="space-y-2">
                <div class="flex justify-between">
                  <span style="color: var(--muted)">Local address</span>
                  <span class="mono text-[12px]">{{ profile.local_address || '—' }}</span>
                </div>
                <div class="flex justify-between">
                  <span style="color: var(--muted)">Remote address</span>
                  <span class="mono text-[12px]">{{ profile.remote_address || '—' }}</span>
                </div>
                <div class="flex justify-between">
                  <span style="color: var(--muted)">Session timeout</span>
                  <span class="mono text-[12px]">{{ profile.session_timeout || '—' }}</span>
                </div>
                <div class="flex justify-between">
                  <span style="color: var(--muted)">Idle timeout</span>
                  <span class="mono text-[12px]">{{ profile.idle_timeout || '—' }}</span>
                </div>
              </div>
            </div>
          </template>

          <template v-if="profile.service_type === 'hotspot'">
            <div class="pt-2" style="border-top: 1px solid var(--border)">
              <div
                class="mb-1 text-[10px] font-semibold uppercase"
                style="color: var(--muted); letter-spacing: 0.08em"
              >
                Hotspot
              </div>
              <div class="space-y-2">
                <div class="flex justify-between">
                  <span style="color: var(--muted)">Address pool</span>
                  <span class="mono text-[12px]">{{ profile.address_pool || '—' }}</span>
                </div>
                <div class="flex justify-between">
                  <span style="color: var(--muted)">Shared users</span>
                  <span class="mono text-[12px]">{{ profile.shared_users }}</span>
                </div>
              </div>
            </div>
          </template>
        </div>
      </section>

      <section>
        <h3
          class="mb-2 text-[10px] font-semibold uppercase"
          style="color: var(--muted); letter-spacing: 0.08em"
        >
          Harga &amp; Status
        </h3>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span style="color: var(--muted)">Harga / bulan</span>
            <span class="font-medium">{{ fmtRp(profile.price_monthly) }}</span>
          </div>
          <div class="flex justify-between">
            <span style="color: var(--muted)">Status</span>
            <Badge :tone="profile.active ? 'success' : 'neutral'">
              {{ profile.active ? 'Aktif' : 'Non-aktif' }}
            </Badge>
          </div>
          <div class="flex justify-between pt-2" style="border-top: 1px solid var(--border)">
            <span style="color: var(--muted)">Dibuat</span>
            <span class="text-xs">{{ fmtDateTime(profile.created_at) }}</span>
          </div>
          <div class="flex justify-between">
            <span style="color: var(--muted)">Diperbarui</span>
            <span class="text-xs">{{ fmtDateTime(profile.updated_at) }}</span>
          </div>
        </div>
      </section>
    </div>

    <template #footer>
      <button class="btn btn-sm" type="button" @click="emit('close')">Tutup</button>
      <button
        v-if="profile"
        class="btn btn-sm"
        type="button"
        style="color: var(--danger)"
        @click="emit('delete', profile)"
      >
        <Icon name="Trash2" :size="13" />
        Hapus
      </button>
      <button
        v-if="profile"
        class="btn btn-primary btn-sm"
        type="button"
        @click="emit('edit', profile)"
      >
        <Icon name="Edit3" :size="13" />
        Edit
      </button>
    </template>
  </Drawer>
</template>
