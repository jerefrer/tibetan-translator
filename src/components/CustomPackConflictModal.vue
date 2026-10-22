<template>
  <ui-dialog v-model="visible" title="Replace dictionary?" :max-width="460" persistent>
    <p class="conflict-text">
      <strong>{{ displayName }}</strong>
      <span v-if="existingVersion"> ({{ existingVersion }})</span>
      is already installed.
    </p>
    <p
      v-if="newVersion && existingVersion && newVersion !== existingVersion"
      class="conflict-text conflict-text--version"
    >
      The new file is version {{ newVersion }}.
    </p>
    <ui-alert v-if="hasLocalEdits" type="warning" class="conflict-warning">
      You have modified this dictionary. Replacing it will discard your changes.
    </ui-alert>
    <template #actions>
      <ui-button variant="outline" @click="onCancel">Cancel</ui-button>
      <ui-button variant="danger" data-testid="conflict-replace" @click="onConfirm">Replace</ui-button>
    </template>
  </ui-dialog>
</template>

<script>
import { UiAlert, UiButton, UiDialog } from '../ui';

export default {
  name: 'CustomPackConflictModal',
  components: { UiAlert, UiButton, UiDialog },
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
    hasLocalEdits() {
      return !!this.existingManifest?.modifiedAt;
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

<style lang="stylus" scoped>
.conflict-text
  margin 0

.conflict-text--version
  margin-top 8px
  color var(--muted)

.conflict-warning
  margin-top 14px
</style>
