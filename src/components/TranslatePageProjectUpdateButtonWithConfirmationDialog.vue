<script>
  export default {
    inheritAttrs: false,
    props: {
      projectName: String
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
        variant="text"
        color="amber"
        v-bind="{ ...props, ...$attrs }"
        @click="dialog = true"
      >
        <v-icon>mdi-content-save-edit</v-icon>
        Update
      </v-btn>
    </template>

    <v-card>

      <v-toolbar
        color="red"
      >
        <v-toolbar-title>
          <v-icon>mdi-alert</v-icon>
          Are you sure?
        </v-toolbar-title>
      </v-toolbar>

      <v-card-text class="pt-6 text-body-1">
        The previous content of "{{projectName}}" will be lost forever.
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
