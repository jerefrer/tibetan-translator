<script>
  export default {
    props: {
      color: String
    },
    computed: {
      colors () {
        return ['', 'yellow darken-4', 'red darken-1', 'green', 'blue', 'purple'];
      }
    }
  }
</script>

<template>
  <v-dialog
    persistent
    scrollable
    :max-width="(68 * colors.length) + 48 + 'px'"
  >

    <template v-slot:activator="{ on, attrs }">
      <v-btn
        :class="color ? '' : 'no-color'"
        class="color-picker-button"
        color="grey darken-2"
        icon
        v-bind="Object.assign({}, attrs, $attrs)"
        v-on="on"
      >
        <v-icon
          v-bind="$attrs"
        >
          mdi-palette
        </v-icon>
      </v-btn>
    </template>

    <template v-slot:default="dialog">

      <v-card>

        <v-card-title />

        <v-card-text class="pt-1">

          <v-btn
            icon
            x-large
            v-for="color in colors"
            :key="color"
            :class="color"
            :outlined="!color"
            class="ma-2"
            @click="$emit('change', color); dialog.value = false"
          />

        </v-card-text>

        <v-card-actions>

          <v-spacer></v-spacer>

          <v-btn
            color="grey darken-1"
            text
            @click="dialog.value = false"
          >
            Cancel
          </v-btn>

        </v-card-actions>

      </v-card>

    </template>

  </v-dialog>
</template>
