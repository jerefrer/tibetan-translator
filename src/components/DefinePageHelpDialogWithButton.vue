<script>
  import DictionariesMenuHelpTab from './DictionariesMenuHelpTab'

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
    computed: {
    }
  }
</script>

<template>
  <v-dialog
    scrollable
    v-model="dialog"
    content-class="help-dialog"
    max-width="1024px"
    overlay-opacity="0.99"
  >

    <template v-slot:activator="{ on, attrs }">
      <v-fab-transition appear>
        <v-btn
          v-if="$route.path.includes('/define')"
          icon large
          v-on="on"
          v-bind="attrs"
          class="help-button"
        >
          <v-icon>mdi-help-circle</v-icon>
        </v-btn>
      </v-fab-transition>
    </template>

    <v-card>

      <v-toolbar
        color="black"
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
            <v-tab>
              Dictionaries filter
            </v-tab>
          </v-tabs>
        </template>

      </v-toolbar>

      <v-card-text class="pt-4">

        <v-tabs-items
          v-model="tab"
        >

          <DictionariesMenuHelpTab />

        </v-tabs-items>

      </v-card-text>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn
          color="grey darken-1"
          text
          @click="dialog = false"
        >
          Close
        </v-btn>
      </v-card-actions>

    </v-card>

  </v-dialog>
</template>
