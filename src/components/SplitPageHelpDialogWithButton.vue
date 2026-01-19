<script>
  import DictionariesMenuHelpTab from './DictionariesMenuHelpTab.vue'

  export default {
    components: {
      DictionariesMenuHelpTab
    },
    data () {
      return {
        dialog: false,
        tab: 0,
        isMobile: window.innerWidth <= 600
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
          v-if="$route.path.includes('/segment')"
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
          How to use the split page
        </v-toolbar-title>

        <template v-slot:extension>
          <v-tabs
            v-model="tab"
            grow
          >
            <v-tab :value="0">
              Dictionaries filter
            </v-tab>
            <v-tab v-if="!isMobile" :value="1">
              Navigation
            </v-tab>
          </v-tabs>
        </template>

      </v-toolbar>

      <v-card-text class="pt-4">

        <v-tabs-window
          v-model="tab"
        >

          <DictionariesMenuHelpTab />

          <v-tabs-window-item v-if="!isMobile">
            <div class="text-h6 mb-3">Keyboard shortcuts</div>
            <v-table>
              <tbody>
                <tr>
                  <td class="pl-0">
                    <v-icon class="keyboard-square">mdi-arrow-up</v-icon>
                  </td>
                  <td class="pl-4">Select previous word in results</td>
                </tr>
                <tr>
                  <td class="pl-0">
                    <v-icon class="keyboard-square">mdi-arrow-down</v-icon>
                  </td>
                  <td class="pl-4">Select next word in results</td>
                </tr>
                <tr>
                  <td class="pl-0">
                    <div class="keyboard-square">Ctrl</div>
                    <div class="text-caption text-grey-darken-1 d-inline-flex align-center mx-2" style="height: 36px">or</div>
                    <v-icon class="keyboard-square">mdi-apple-keyboard-command</v-icon>
                    <v-icon class="keyboard-square ml-1">mdi-keyboard-return</v-icon>
                  </td>
                  <td class="pl-4">Split the text into words</td>
                </tr>
                <tr>
                  <td class="pl-0">
                    <div class="keyboard-square">Ctrl</div>
                    <div class="text-caption text-grey-darken-1 d-inline-flex align-center mx-2" style="height: 36px">or</div>
                    <v-icon class="keyboard-square">mdi-apple-keyboard-command</v-icon>
                    <div class="keyboard-square ml-1">D</div>
                  </td>
                  <td class="pl-4">Go to <u>D</u>efine page</td>
                </tr>
                <tr>
                  <td class="pl-0">
                    <div class="keyboard-square">Ctrl</div>
                    <div class="text-caption text-grey-darken-1 d-inline-flex align-center mx-2" style="height: 36px">or</div>
                    <v-icon class="keyboard-square">mdi-apple-keyboard-command</v-icon>
                    <div class="keyboard-square ml-1">S</div>
                  </td>
                  <td class="pl-4">Go to <u>S</u>earch page</td>
                </tr>
                <tr>
                  <td class="pl-0">
                    <div class="keyboard-square">Ctrl</div>
                    <div class="text-caption text-grey-darken-1 d-inline-flex align-center mx-2" style="height: 36px">or</div>
                    <v-icon class="keyboard-square">mdi-apple-keyboard-command</v-icon>
                    <div class="keyboard-square ml-1">T</div>
                  </td>
                  <td class="pl-4">Go to Spli<u>t</u> page</td>
                </tr>
                <tr>
                  <td class="pl-0">
                    <div class="keyboard-square">Ctrl</div>
                    <div class="text-caption text-grey-darken-1 d-inline-flex align-center mx-2" style="height: 36px">or</div>
                    <v-icon class="keyboard-square">mdi-apple-keyboard-command</v-icon>
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
