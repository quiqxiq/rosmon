import { createApp } from 'vue'
import App from './App.vue'
import { pinia } from '@/plugins/pinia'
import { VueQueryPlugin, vueQueryPluginOptions } from '@/plugins/vue-query'
import { router } from '@/router'
import '@/plugins/echarts'
import '@/assets/styles/main.css'

const app = createApp(App)
app.use(pinia)
app.use(router)
app.use(VueQueryPlugin, vueQueryPluginOptions)
app.mount('#app')
