import Vue from 'vue'
import Vuetify from 'vuetify'
import 'vuetify/dist/vuetify.min.css'

import Storage from '../services/storage'

Vue.use(Vuetify)

const options = {
  theme: {
    dark: Storage.get('darkTheme'),
    themes: {
      light: {
        primary: '#A30000', // Deep red
        secondary: '#FFC107', // Yellow
        accent: '#FF9800', // Orange accent
        background: '#FAF3E0', // Light paper-like background
        error: '#FF5252',
        info: '#2196F3',
        success: '#4CAF50',
        warning: '#FB8C00',
      },
      dark: {
        primary: '#FFC107', // Yellow
      }
    },
  },
  icons: {
    iconfont: 'mdi',
  },
}

export default new Vuetify(options)