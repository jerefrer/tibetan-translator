<script>
  import Storage from '../services/storage'

  export default {
    data () {
      return {
        dialog: false,
        text: '',
        autoFillWords: Storage.get('autoFillWords'),
        keepLongestOnly: Storage.get('keepLongestOnly'),
      }
    },
    watch: {
      dialog (value) {
        if (value)
          this.text = '';
      },
      autoFillWords (value) {
        Storage.set('autoFillWords', value);
      },
      keepLongestOnly (value) {
        Storage.set('keepLongestOnly', value);
      }
    }
  }
</script>

<template>
  <v-dialog
    v-model="dialog"
    scrollable
    max-width="640px"
  >

    <template v-slot:activator="{ on, attrs }">
      <v-btn
        icon large
        id="paste-dialog-button"
        @click="dialog = true"
      >
        <v-icon>mdi-clipboard-text-multiple</v-icon>
      </v-btn>
    </template>

    <v-card>

      <v-card-title class="text-h5">
        Paste text
      </v-card-title>

      <v-card-text class="pt-1">

        <v-switch
          v-model="autoFillWords"
          inset
          label="Automatically add cards for all words that have a definition in the dictionary"
        />

        <v-switch
          :disabled="!autoFillWords"
          v-model="keepLongestOnly"
          inset
          label="Remove smaller words if they are part of a longer one"
          class="mt-0 mb-2"
        />

        <p>
          You can paste below either pure Tibetan, or alternated Tibetan
          and translation, or first Tibetan then translation.
        </p>

        <v-textarea
          autofocus
          auto-grow
          rows="14"
          v-model="text"
          class="tibetan"
          spellcheck="false"
        />

      </v-card-text>

      <v-card-actions>

        <v-spacer></v-spacer>

        <v-btn
          color="grey darken-1"
          text
          @click="dialog = false"
        >
          Cancel
        </v-btn>

        <v-btn
          color="green"
          text
          @click="$emit('confirm', text); dialog = false"
        >
          Go
        </v-btn>

      </v-card-actions>

    </v-card>

  </v-dialog>
</template>
