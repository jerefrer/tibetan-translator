import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

import Storage from '../services/storage'

const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: Storage.get('darkTheme') ? 'dark' : 'light',
    themes: {
      light: {
        dark: false,
        colors: {
          primary: '#A30000', // Deep red
          secondary: '#FFC107', // Yellow
          accent: '#FF9800', // Orange accent
          background: '#FAF3E0', // Light paper-like background
          error: '#FF5252',
          info: '#2196F3',
          success: '#4CAF50',
          warning: '#FB8C00',
        },
      },
      dark: {
        dark: true,
        colors: {
          primary: '#FFC107', // Yellow
        },
      },
    },
  },
  icons: {
    defaultSet: 'mdi',
  },
})

export default vuetify
