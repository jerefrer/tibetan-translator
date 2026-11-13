<script>
import Storage from '../../services/storage';
import { applyDocumentTheme, resolveTheme, systemPrefersDark } from '../../services/theme';
import { UiButton, UiIcon, UiSegmented, UiSlider } from '../../ui';
import SettingsGroup from './SettingsGroup.vue';
import SettingsRow from './SettingsRow.vue';

export const THEME_OPTIONS = [
  { value: 'system', label: 'System', icon: 'monitor' },
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
];

export const DEFAULT_FONT_SIZE = 100;

// Settings' General group: the theme (system / light / dark) and the text size.
export default {
  name: 'AppearanceCard',
  components: { SettingsGroup, SettingsRow, UiButton, UiIcon, UiSegmented, UiSlider },
  data() {
    return {
      themeOptions: THEME_OPTIONS,
      themePreference: Storage.get('themePreference'),
      fontSize: Storage.get('fontSize') || DEFAULT_FONT_SIZE,
      defaultFontSize: DEFAULT_FONT_SIZE,
    };
  },
  watch: {
    themePreference(value) {
      Storage.set('themePreference', value);
      this.applyTheme(value);
    },
    fontSize(value) {
      Storage.set('fontSize', value);
      this.applyFontSize(value);
    },
  },
  created() {
    // OS theme changes are followed by App.vue (watchSystemTheme)
    this.applyFontSize(this.fontSize);
  },
  methods: {
    applyTheme(preference) {
      applyDocumentTheme(resolveTheme(preference, systemPrefersDark()));
    },
    applyFontSize(size) {
      document.documentElement.style.setProperty('--app-font-size', `${size}%`);
      document.documentElement.style.fontSize = `${size}%`;
    },
  },
};
</script>

<template>
  <settings-group id="settings-general" title="General" class="appearance-card" data-testid="appearance-card">
    <settings-row title="Theme">
      <ui-segmented v-model="themePreference" :options="themeOptions" label="Theme" data-testid="theme" />
    </settings-row>
    <settings-row title="Text size" description="Definitions, lists and the interface" class="appearance-card__size">
      <ui-button
        v-if="fontSize !== defaultFontSize"
        variant="ghost"
        size="sm"
        data-testid="font-size-reset"
        @click="fontSize = defaultFontSize"
      >
        <ui-icon name="rotate-ccw" :size="15" />
        Reset
      </ui-button>
      <ui-slider
        v-model="fontSize"
        :min="80"
        :max="130"
        :step="5"
        label="Text size"
        class="appearance-card__slider"
      />
      <span class="appearance-card__size-value" data-testid="font-size-value">{{ fontSize }}%</span>
    </settings-row>
  </settings-group>
</template>

<style>
.appearance-card__slider {
  width: 11rem;
}
.appearance-card__size-value {
  width: 2.5rem;
  font-size: var(--text-sm);
  font-variant-numeric: tabular-nums;
  text-align: right;
  color: var(--muted);
}
/* Phone: the slider under the name, across the row */
@media (max-width: 600px) {
  .appearance-card__size.settings-row {
    flex-wrap: wrap;
  }
  .appearance-card__size .settings-row__control {
    flex: 1 1 100%;
  }
  .appearance-card__slider {
    flex: 1;
    width: auto;
  }
}
</style>
