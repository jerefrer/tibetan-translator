<script>
  export default {
    props: {
      color: String
    },
    computed: {
      colors () {
        return ['', 'bg-yellow-darken-4', 'bg-red-darken-1', 'bg-green', 'bg-blue', 'bg-purple'];
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

    <template v-slot:activator="{ props }">
      <v-btn
        :class="color ? '' : 'no-color'"
        class="color-picker-button"
        color="grey-darken-2"
        icon
        variant="text"
        v-bind="{ ...props, ...$attrs }"
      >
        <v-icon
          v-bind="$attrs"
        >
          mdi-palette
        </v-icon>
      </v-btn>
    </template>

    <template v-slot:default="{ isActive }">

      <v-card>

        <v-card-title />

        <v-card-text class="pt-1">

          <v-btn
            icon
            size="x-large"
            v-for="color in colors"
            :key="color"
            :class="color"
            :variant="color ? undefined : 'outlined'"
            class="ma-2"
            @click="$emit('change', color); isActive.value = false"
          />

        </v-card-text>

        <v-card-actions>

          <v-spacer></v-spacer>

          <v-btn
            color="grey-darken-1"
            variant="text"
            @click="isActive.value = false"
          >
            Cancel
          </v-btn>

        </v-card-actions>

      </v-card>

    </template>

  </v-dialog>
</template>
