import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'
import './style.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createVuetify } from 'vuetify'

import App from './App.vue'

const vuetify = createVuetify({
  theme: { defaultTheme: 'dark' },
})

createApp(App).use(createPinia()).use(vuetify).mount('#app')
