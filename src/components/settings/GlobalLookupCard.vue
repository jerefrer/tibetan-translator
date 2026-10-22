<script>
import GlobalLookup from '../../services/global-lookup';
import { UiAlert, UiButton, UiSwitch, UiTextField } from '../../ui';
import SettingsCard from './SettingsCard.vue';

export const DEFAULT_HOTKEY = 'CommandOrControl+Shift+D';

// Desktop only: the system-wide hotkey that looks up the clipboard.
// Renders nothing where GlobalLookup is not supported.
export default {
  name: 'GlobalLookupCard',
  components: { SettingsCard, UiAlert, UiButton, UiSwitch, UiTextField },
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
        this.snackbar.open('Accessibility permission required. Click "Grant permission" below.');
      } else {
        this.snackbar.open(`Failed to register hotkey: ${result.error || 'Unknown error'}`);
      }
    },
    async openAccessibilitySettings() {
      await GlobalLookup.requestAccessibilityPermission();
      this.snackbar.open(
        'Please enable Tibetan Translator in Accessibility settings, then toggle Global lookup off and on again.'
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
  <settings-card
    v-if="supported"
    title="Global lookup"
    subtitle="Look up Tibetan text from anywhere on your system"
    class="global-lookup-card"
    data-testid="global-lookup-card"
  >
    <template #aside>
      <ui-switch v-model="enabled" data-testid="global-lookup-switch" />
    </template>

    <ui-alert
      v-if="showPermissionWarning"
      type="warning"
      title="Accessibility permission required"
      data-testid="accessibility-warning"
    >
      <div class="global-lookup-card__warning">
        <span>Global hotkeys need accessibility access to work system-wide.</span>
        <ui-button size="sm" data-testid="grant-permission" @click="openAccessibilitySettings">
          Grant permission
        </ui-button>
      </div>
    </ui-alert>

    <div class="global-lookup-card__hotkey" :class="{ 'is-disabled': !enabled }">
      <div class="global-lookup-card__row">
        <span class="global-lookup-card__label">Hotkey</span>
        <ui-text-field
          ref="hotkeyField"
          :model-value="fieldValue"
          readonly
          aria-label="Hotkey"
          class="global-lookup-card__field"
          :class="{ 'is-recording': isRecording }"
          data-testid="hotkey-field"
          @keydown="onHotkeyKeydown"
          @blur="stopRecording"
        />
        <ui-button v-if="!isRecording" variant="outline" data-testid="hotkey-change" @click="startRecording">
          Change
        </ui-button>
        <ui-button v-else variant="ghost" data-testid="hotkey-cancel" @mousedown.prevent @click="stopRecording">
          Cancel
        </ui-button>
        <ui-button variant="ghost" data-testid="hotkey-reset" @click="resetToDefault">Reset</ui-button>
      </div>
      <p class="global-lookup-card__hint">Copy Tibetan text anywhere, then press the hotkey to look it up</p>
    </div>
  </settings-card>
</template>

<style>
.global-lookup-card__warning {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2) var(--space-3);
}
.global-lookup-card__hotkey.is-disabled {
  opacity: 0.5;
  pointer-events: none;
}
.global-lookup-card__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}
.global-lookup-card__label {
  font-size: var(--text-base);
}
.global-lookup-card__field {
  width: 15.5rem;
  max-width: 100%;
}
/* Mockup: a 38px box with the keys in semibold */
.global-lookup-card__field .ui-field__control {
  min-height: 2.375rem;
  border-radius: var(--radius-md);
}
.global-lookup-card__field .ui-field__input {
  font-size: var(--text-base);
  font-weight: 600;
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
.global-lookup-card__hint {
  margin: var(--space-2) 0 0;
  font-size: var(--text-xs);
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
