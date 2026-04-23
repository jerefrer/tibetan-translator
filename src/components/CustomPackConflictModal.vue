<template>
  <v-dialog v-model="visible" max-width="420" persistent>
    <v-card>
      <v-card-title>Replace dictionary?</v-card-title>
      <v-card-text>
        <p v-if="existingVersion">
          «&nbsp;<strong>{{ existingName }}</strong>&nbsp;» ({{ existingVersion }}) is already installed.
        </p>
        <p v-else>
          «&nbsp;<strong>{{ existingName }}</strong>&nbsp;» is already installed.
        </p>
        <p v-if="newVersion">The new file is {{ newVersion }}.</p>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="onCancel">Cancel</v-btn>
        <v-btn color="primary" @click="onConfirm">Replace</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
export default {
  name: 'CustomPackConflictModal',
  props: {
    modelValue: { type: Boolean, default: false },
    existingName: { type: String, default: 'This dictionary' },
    existingVersion: { type: String, default: '' },
    newVersion: { type: String, default: '' },
  },
  emits: ['update:modelValue', 'confirm', 'cancel'],
  computed: {
    visible: {
      get() { return this.modelValue; },
      set(v) { this.$emit('update:modelValue', v); },
    },
  },
  methods: {
    onConfirm() {
      this.visible = false;
      this.$emit('confirm');
    },
    onCancel() {
      this.visible = false;
      this.$emit('cancel');
    },
  },
};
</script>
