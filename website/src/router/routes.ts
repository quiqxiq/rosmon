import type { RouteRecordRaw } from 'vue-router'

export const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    component: () => import('@/layouts/AuthLayout.vue'),
    children: [
      {
        path: '',
        name: 'login',
        component: () => import('@/pages/LoginPage.vue'),
        meta: { auth: false },
      },
    ],
  },
  {
    path: '/',
    component: () => import('@/layouts/DefaultLayout.vue'),
    meta: { auth: true },
    children: [
      { path: '', redirect: { name: 'overview' } },
      { path: 'overview', name: 'overview', component: () => import('@/pages/OverviewPage.vue') },
      { path: 'devices', name: 'devices', component: () => import('@/pages/DevicesPage.vue') },
      {
        path: 'hotspot',
        redirect: { name: 'hotspot', params: { tab: 'users' } },
      },
      {
        path: 'hotspot/:tab?',
        name: 'hotspot',
        component: () => import('@/pages/HotspotPage.vue'),
      },
      {
        path: 'hotspot/voucher',
        name: 'voucher',
        component: () => import('@/pages/VoucherPage.vue'),
      },
      { path: 'ppp', name: 'ppp', component: () => import('@/pages/PPPPage.vue') },
      { path: 'customers', name: 'customers', component: () => import('@/pages/CustomersPage.vue') },
      {
        path: 'subscriptions',
        name: 'subscriptions',
        component: () => import('@/pages/SubscriptionsPage.vue'),
      },
      {
        path: 'bandwidth-profiles',
        name: 'bandwidth-profiles',
        component: () => import('@/pages/BandwidthProfilesPage.vue'),
      },
      { path: 'network', name: 'network', component: () => import('@/pages/NetworkPage.vue') },
      { path: 'system', name: 'system', component: () => import('@/pages/SystemPage.vue') },
      { path: 'reports', name: 'reports', component: () => import('@/pages/ReportsPage.vue') },
      { path: 'settings', name: 'settings', component: () => import('@/pages/SettingsPage.vue') },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    component: () => import('@/layouts/BlankLayout.vue'),
    children: [
      { path: '', name: 'not-found', component: () => import('@/pages/NotFoundPage.vue') },
    ],
  },
]
