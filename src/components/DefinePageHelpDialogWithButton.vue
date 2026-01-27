<script>
  import DictionariesMenuHelpTab from './DictionariesMenuHelpTab.vue'
  import { isMacOS, isTauri, isMobile } from '../config/platform'

  export default {
    components: {
      DictionariesMenuHelpTab
    },
    data () {
      return {
        dialog: false,
        tab: 0,
        isMobile: window.innerWidth <= 600,
        isMac: isMacOS(),
        isDesktop: isTauri() && !isMobile()
      }
    },
    computed: {
      modifierKey() {
        return this.isMac ? '⌘' : 'Ctrl'
      }
    },
    methods: {
      handleResize() {
        this.isMobile = window.innerWidth <= 600;
      }
    },
    mounted() {
      window.addEventListener('resize', this.handleResize);
    },
    beforeUnmount() {
      window.removeEventListener('resize', this.handleResize);
    }
  }
</script>

<template>
  <v-dialog
    scrollable
    v-model="dialog"
    content-class="help-dialog"
    max-width="1024px"
    scrim-opacity="0.99"
  >

    <template v-slot:activator="{ props }">
      <v-fab-transition appear>
        <v-btn
          v-if="$route.path.includes('/define')"
          icon
          variant="text"
          size="large"
          v-bind="props"
          class="help-button"
          @click.stop.prevent
        >
          <v-icon>mdi-help-circle</v-icon>
        </v-btn>
      </v-fab-transition>
    </template>

    <v-card>

      <v-toolbar
        height="54"
        class="mb-1"
      >

        <v-toolbar-title>
          <v-icon>mdi-help-circle</v-icon>
          How to use the define page
        </v-toolbar-title>

        <template v-slot:extension>
          <v-tabs
            v-model="tab"
            grow
          >
            <v-tab :value="0">
              Dictionaries filter
            </v-tab>
            <v-tab v-if="isDesktop" :value="1">
              Quick Lookup
            </v-tab>
            <v-tab v-if="!isMobile" :value="2">
              Navigation
            </v-tab>
          </v-tabs>
        </template>

      </v-toolbar>

      <v-card-text class="pt-4" :class="{ 'quick-lookup-active': tab === 1 }">

        <v-tabs-window
          v-model="tab"
        >

          <DictionariesMenuHelpTab />

          <v-tabs-window-item v-if="isDesktop">
            <div class="quick-lookup-layout">
              <div class="quick-lookup-video">
                <div class="demo-video">
                  <video
                    src="/img/global-lookup-demo.mp4"
                    autoplay
                    loop
                    muted
                    playsinline
                  />
                </div>
              </div>
              <div class="quick-lookup-content">
                <p class="text-body-1 mb-4">
                  You can look up Tibetan text from anywhere on your system using a keyboard shortcut.
                </p>

                <v-table class="lookup-steps-table mb-4">
                  <tbody>
                    <tr>
                      <td class="pl-0 pr-4" style="white-space: nowrap">
                        <span class="keyboard-square">{{ modifierKey }}</span>
                        <span class="keyboard-square">C</span>
                      </td>
                      <td>
                        <strong>Copy</strong> Tibetan text from any app
                      </td>
                    </tr>
                    <tr>
                      <td class="pl-0 pr-4" style="white-space: nowrap">
                        <span class="keyboard-square">{{ modifierKey }}</span>
                        <v-icon class="keyboard-square">mdi-apple-keyboard-shift</v-icon>
                        <span class="keyboard-square">C</span>
                      </td>
                      <td>
                        <strong>Open</strong> the lookup popup with dictionary results
                      </td>
                    </tr>
                  </tbody>
                </v-table>

                <v-alert type="info" variant="tonal" density="compact" class="text-caption">
                  <template v-slot:prepend>
                    <v-icon size="small">mdi-information</v-icon>
                  </template>
                  You can change this hotkey in the Configure page under Global Lookup Settings.
                </v-alert>
              </div>
            </div>
          </v-tabs-window-item>

          <v-tabs-window-item v-if="!isMobile">
            <div class="text-h6 mb-3">Keyboard shortcuts</div>
            <v-table>
              <tbody>
                <tr>
                  <td class="pl-0">
                    <v-icon class="keyboard-square">mdi-arrow-up</v-icon>
                  </td>
                  <td class="pl-4">Select previous entry in results</td>
                </tr>
                <tr>
                  <td class="pl-0">
                    <v-icon class="keyboard-square">mdi-arrow-down</v-icon>
                  </td>
                  <td class="pl-4">Select next entry in results</td>
                </tr>
                <tr>
                  <td class="pl-0">
                    <v-icon v-if="isMac" class="keyboard-square">mdi-apple-keyboard-command</v-icon>
                    <div v-else class="keyboard-square">Ctrl</div>
                    <div class="keyboard-square ml-1">D</div>
                  </td>
                  <td class="pl-4">Go to <u>D</u>efine page</td>
                </tr>
                <tr>
                  <td class="pl-0">
                    <v-icon v-if="isMac" class="keyboard-square">mdi-apple-keyboard-command</v-icon>
                    <div v-else class="keyboard-square">Ctrl</div>
                    <div class="keyboard-square ml-1">S</div>
                  </td>
                  <td class="pl-4">Go to <u>S</u>earch page</td>
                </tr>
                <tr>
                  <td class="pl-0">
                    <v-icon v-if="isMac" class="keyboard-square">mdi-apple-keyboard-command</v-icon>
                    <div v-else class="keyboard-square">Ctrl</div>
                    <div class="keyboard-square ml-1">T</div>
                  </td>
                  <td class="pl-4">Go to Spli<u>t</u> page</td>
                </tr>
                <tr>
                  <td class="pl-0">
                    <v-icon v-if="isMac" class="keyboard-square">mdi-apple-keyboard-command</v-icon>
                    <div v-else class="keyboard-square">Ctrl</div>
                    <div class="keyboard-square ml-1">G</div>
                  </td>
                  <td class="pl-4">Go to Confi<u>g</u>ure page</td>
                </tr>
              </tbody>
            </v-table>
          </v-tabs-window-item>

        </v-tabs-window>

      </v-card-text>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn
          color="grey-darken-1"
          variant="text"
          @click="dialog = false"
        >
          Close
        </v-btn>
      </v-card-actions>

    </v-card>

  </v-dialog>
</template>
