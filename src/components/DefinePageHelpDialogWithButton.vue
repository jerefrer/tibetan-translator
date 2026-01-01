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
          </v-tabs>
        </template>

      </v-toolbar>

      <v-card-text class="pt-4">

        <v-tabs-window
          v-model="tab"
        >

          <DictionariesMenuHelpTab />

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
