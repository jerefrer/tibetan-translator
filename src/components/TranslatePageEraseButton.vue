<script>
  export default {
    inheritAttrs: false,
    props: {
      doConfirm: Boolean
    },
    data () {
      return {
        dialog: false,
      }
    }
  }
</script>

<template>
  <v-dialog
    v-model="dialog"
    persistent
    :max-width="480"
  >

    <template v-slot:activator="{ props }">
      <v-btn
        icon
        variant="text"
        size="large"
        v-bind="{ ...props, ...$attrs }"
        id="delete-all-lines-button"
        title="Start afresh"
        @click="doConfirm ? dialog = true : $emit('confirm')"
      >
        <v-icon>mdi-eraser</v-icon>
      </v-btn>
    </template>

    <v-card>

      <v-toolbar
        color="red"
      >
        <v-toolbar-title>
          <v-icon>mdi-alert</v-icon>
          Are you sure want to erase everything?
        </v-toolbar-title>
      </v-toolbar>

      <v-card-text class="pt-6 text-body-1">
        Your current translation hasn't been saved. If you proceed you
        might lose your work.
      </v-card-text>

      <v-card-actions>

        <v-spacer></v-spacer>

        <v-btn
          color="grey-darken-1"
          @click="dialog = false"
        >
          Cancel
        </v-btn>

        <v-btn
          color="red"
          @click="$emit('confirm'); dialog = false"
        >
          Do it
        </v-btn>

      </v-card-actions>

    </v-card>

  </v-dialog>
</template>
