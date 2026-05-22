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
        path: 'hotspot/users',
        name: 'hotspot-users',
        component: () => import('@/pages/HotspotUsersPage.vue'),
      },
      {
        path: 'hotspot/profiles',
        name: 'hotspot-profiles',
        component: () => import('@/pages/HotspotProfilesPage.vue'),
      },
      {
        path: 'hotspot/sessions',
        name: 'hotspot-sessions',
        component: () => import('@/pages/HotspotSessionsPage.vue'),
      },
      {
        path: 'hotspot/voucher',
        name: 'voucher',
        component: () => import('@/pages/VoucherPage.vue'),
      },
      { path: 'ppp', name: 'ppp', component: () => import('@/pages/PPPPage.vue') },
      { path: 'network', name: 'network', component: () => import('@/pages/NetworkPage.vue') },
      { path: 'system', name: 'system', component: () => import('@/pages/SystemPage.vue') },
      { path: 'reports', name: 'reports', component: () => import('@/pages/ReportsPage.vue') },
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
