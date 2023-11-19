import Vue from 'vue'
import Vuetify from 'vuetify'
import 'vuetify/dist/vuetify.min.css'

import Storage from '../services/storage'

Vue.use(Vuetify)

const options = {
  theme: {
    dark: Storage.get('darkTheme') == undefined ? true : Storage.get('darkTheme')
  },
  icons: {
    iconfont: 'mdi',
  },
}

export default new Vuetify(options)