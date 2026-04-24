<template>
  <v-dialog v-model="visible" max-width="460" persistent>
    <v-card>
      <v-toolbar color="error" density="compact">
        <v-icon class="ms-3 me-2">mdi-file-replace-outline</v-icon>
        <v-toolbar-title class="text-subtitle-1 font-weight-medium">
          Replace dictionary?
        </v-toolbar-title>
      </v-toolbar>

      <v-card-text class="pt-5">
        <p>
          <strong>{{ displayName }}</strong>
          <span v-if="existingVersion"> ({{ existingVersion }})</span>
          is already installed.
        </p>
        <p v-if="newVersion && existingVersion && newVersion !== existingVersion" class="mt-2">
          The new file is version {{ newVersion }}.
        </p>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="onCancel">Cancel</v-btn>
        <v-btn color="error" variant="elevated" @click="onConfirm">Replace</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
export default {
  name: 'CustomPackConflictModal',
  props: {
    modelValue: { type: Boolean, default: false },
    existingManifest: { type: Object, default: null },
    incomingManifest: { type: Object, default: null },
  },
  emits: ['update:modelValue', 'confirm', 'cancel'],
  computed: {
    visible: {
      get() { return this.modelValue; },
      set(v) { this.$emit('update:modelValue', v); },
    },
    displayName() {
      return (
        this.existingManifest?.name ||
        this.incomingManifest?.name ||
        'This dictionary'
      );
    },
    existingVersion() {
      return this.existingManifest?.version
        ? `v${this.existingManifest.version}`
        : '';
    },
    newVersion() {
      return this.incomingManifest?.version
        ? `v${this.incomingManifest.version}`
        : '';
    },
  },
  methods: {
    onConfirm() {
      this.$emit('confirm');
    },
    onCancel() {
      this.$emit('cancel');
    },
  },
};
</script>
