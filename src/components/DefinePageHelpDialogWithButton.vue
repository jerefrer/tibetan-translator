<script>
  import DictionariesMenuHelpTab from './DictionariesMenuHelpTab.vue'

  export default {
    components: {
      DictionariesMenuHelpTab
    },
    data () {
      return {
        dialog: false,
        tab: 0
      }
    },
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
            <v-tab :value="1">
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

          <v-tabs-window-item>
            <div class="text-h6 mb-3">Keyboard shortcuts</div>
            <v-table class="d-none d-sm-table">
              <tbody>
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
                    <div class="keyboard-square ml-1">G</div>
                  </td>
                  <td class="pl-4">Go to Confi<u>g</u>ure page</td>
                </tr>
              </tbody>
            </v-table>
            <v-alert
              variant="tonal"
              density="compact"
              type="info"
              class="text-caption mt-4 d-sm-none"
              icon="mdi-keyboard"
            >
              Navigation shortcuts are available on desktop: Ctrl/Cmd+D (Define), Ctrl/Cmd+S (Search), Ctrl/Cmd+G (Configure)
            </v-alert>
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
