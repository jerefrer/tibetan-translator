<script>
import GlobalLookup, { DEFAULT_HOTKEY } from '../../services/global-lookup';
import { UiButton, UiIcon, UiSwitch, UiTextField } from '../../ui';
import SettingsGroup from './SettingsGroup.vue';
import SettingsRow from './SettingsRow.vue';

// Reset goes back to the shortcut the app starts with (global-lookup.js)
export { DEFAULT_HOTKEY };

// Settings' Quick lookup group, desktop only: the system-wide shortcut that
// looks up the clipboard, or the selection when pressed in this app.
// Renders nothing where GlobalLookup is not supported.
export default {
  name: 'GlobalLookupCard',
  components: { SettingsGroup, SettingsRow, UiButton, UiIcon, UiSwitch, UiTextField },
  inject: ['snackbar'],
  data() {
    return {
      supported: false,
      enabled: true,
      hotkey: '',
      hotkeyDisplay: '',
      isRecording: false,
      needsAccessibilityPermission: false,
      isMacOS: false,
    };
  },
  computed: {
    fieldValue() {
      return this.isRecording ? 'Press any key combination...' : this.hotkeyDisplay;
    },
    showPermissionWarning() {
      return this.needsAccessibilityPermission && this.isMacOS && this.enabled;
    },
  },
  watch: {
    async enabled(value) {
      const result = await GlobalLookup.toggle(value);
      this.needsAccessibilityPermission = !result.success && !!result.needsPermission;
    },
  },
  async created() {
    this.supported = GlobalLookup.isSupported();
    if (!this.supported) return;
    this.isMacOS = GlobalLookup.isMacOS();
    this.enabled = GlobalLookup.isEnabled();
    this.hotkey = GlobalLookup.getHotkey();
    this.hotkeyDisplay = GlobalLookup.formatHotkeyForDisplay(this.hotkey);

    if (this.isMacOS && this.enabled) {
      const hasPermission = await GlobalLookup.checkAccessibilityPermission();
      this.needsAccessibilityPermission = !hasPermission;
    }
  },
  methods: {
    startRecording() {
      this.isRecording = true;
      this.$nextTick(() => this.$refs.hotkeyField?.focus());
    },
    stopRecording() {
      this.isRecording = false;
    },
    async onHotkeyKeydown(event) {
      if (!this.isRecording) return;

      event.preventDefault();
      event.stopPropagation();

      const hotkeyString = GlobalLookup.keyEventToHotkeyString(event);
      if (!hotkeyString) return;

      this.hotkey = hotkeyString;
      this.hotkeyDisplay = GlobalLookup.formatHotkeyForDisplay(hotkeyString);
      this.isRecording = false;

      const result = await GlobalLookup.updateHotkey(hotkeyString);
      if (result.success) {
        this.needsAccessibilityPermission = false;
        this.snackbar.open('Hotkey updated successfully');
      } else if (result.needsPermission) {
        this.needsAccessibilityPermission = true;
        this.snackbar.open('macOS needs your permission first: see Quick lookup in Settings.');
      } else {
        this.snackbar.open(`Failed to register hotkey: ${result.error || 'Unknown error'}`);
      }
    },
    async openAccessibilitySettings() {
      await GlobalLookup.requestAccessibilityPermission();
      this.snackbar.open(
        'Turn Tibetan Translator on in Accessibility, then switch Quick lookup off and on again.'
      );
    },
    resetToDefault() {
      this.hotkey = DEFAULT_HOTKEY;
      this.hotkeyDisplay = GlobalLookup.formatHotkeyForDisplay(DEFAULT_HOTKEY);
      GlobalLookup.updateHotkey(DEFAULT_HOTKEY);
    },
  },
};
</script>

<template>
  <settings-group
    v-if="supported"
    id="settings-quick-lookup"
    title="Quick lookup"
    class="global-lookup-card"
    data-testid="global-lookup-card"
  >
    <settings-row
      title="Look up from any app"
      description="Copy Tibetan text anywhere, then press the shortcut to see its entry in a small window. In this app, selecting it is enough."
    >
      <ui-switch v-model="enabled" aria-label="Look up from any app" data-testid="global-lookup-switch" />
    </settings-row>

    <settings-row
      v-if="showPermissionWarning"
      title="macOS needs your permission"
      description="Allow Tibetan Translator in Privacy & Security › Accessibility, or the shortcut cannot read the copied text."
      tone="warning"
      data-testid="accessibility-warning"
    >
      <ui-button variant="outline" size="sm" data-testid="grant-permission" @click="openAccessibilitySettings">
        <ui-icon name="external-link" :size="15" />
        Open System Settings
      </ui-button>
    </settings-row>

    <settings-row title="Shortcut" class="global-lookup-card__hotkey" :class="{ 'is-disabled': !enabled }">
      <ui-text-field
        ref="hotkeyField"
        :model-value="fieldValue"
        readonly
        aria-label="Shortcut"
        class="global-lookup-card__field"
        :class="{ 'is-recording': isRecording }"
        data-testid="hotkey-field"
        @keydown="onHotkeyKeydown"
        @blur="stopRecording"
      />
      <ui-button v-if="!isRecording" variant="outline" size="sm" data-testid="hotkey-change" @click="startRecording">
        <ui-icon name="keyboard" :size="15" />
        Change
      </ui-button>
      <ui-button v-else variant="ghost" size="sm" data-testid="hotkey-cancel" @mousedown.prevent @click="stopRecording">
        Cancel
      </ui-button>
      <ui-button variant="ghost" size="sm" data-testid="hotkey-reset" @click="resetToDefault"><ui-icon name="rotate-ccw" :size="15" />Reset</ui-button>
    </settings-row>
  </settings-group>
</template>

<style>
.global-lookup-card__hotkey.is-disabled {
  opacity: 0.5;
  pointer-events: none;
}
.global-lookup-card__field {
  width: 13rem;
}
.global-lookup-card__field .ui-field__control {
  min-height: var(--control-sm);
  border-radius: var(--radius-md);
}
.global-lookup-card__field .ui-field__input {
  font-size: var(--text-base);
  font-weight: 600;
  text-align: center;
  cursor: default;
}
.global-lookup-card__field.is-recording .ui-field__control {
  border-color: var(--accent);
  box-shadow: 0 0 0 4px var(--ring);
  animation: global-lookup-pulse 1s infinite;
}
.global-lookup-card__field.is-recording .ui-field__input {
  font-weight: 500;
  color: var(--muted);
}
@keyframes global-lookup-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
@media (prefers-reduced-motion: reduce) {
  .global-lookup-card__field.is-recording .ui-field__control { animation: none; }
}
</style>
