<script>
import { useTheme } from 'vuetify';

import Storage from '../../services/storage';
import { resolveTheme, systemPrefersDark } from '../../services/theme';
import { UiButton, UiIcon, UiSlider } from '../../ui';
import SettingsCard from './SettingsCard.vue';

export const THEME_OPTIONS = [
  { value: 'system', label: 'System', icon: 'monitor' },
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
];

export const DEFAULT_FONT_SIZE = 100;

// Theme (system / light / dark) and the "Text size" slider.
export default {
  name: 'AppearanceCard',
  components: { SettingsCard, UiButton, UiIcon, UiSlider },
  setup() {
    // Vuetify still themes the screens not yet rebuilt; App.vue mirrors its
    // theme onto <html data-theme>, which the new tokens read. Drop this
    // together with Vuetify.
    return { theme: useTheme() };
  },
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
    this.applyFontSize(this.fontSize);
    this.mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
    this.onSystemThemeChange = () => {
      if (this.themePreference === 'system') this.applyTheme('system');
    };
    this.mediaQuery?.addEventListener?.('change', this.onSystemThemeChange);
  },
  unmounted() {
    this.mediaQuery?.removeEventListener?.('change', this.onSystemThemeChange);
  },
  methods: {
    applyTheme(preference) {
      const actualTheme = resolveTheme(preference, systemPrefersDark());
      this.theme.global.name.value = actualTheme;
      Storage.set('darkTheme', actualTheme === 'dark');
    },
    applyFontSize(size) {
      document.documentElement.style.setProperty('--app-font-size', `${size}%`);
      document.documentElement.style.fontSize = `${size}%`;
    },
  },
};
</script>

<template>
  <settings-card title="Appearance" class="appearance-card" data-testid="appearance-card">
    <div class="appearance-card__themes" role="group" aria-label="Theme">
      <ui-button
        v-for="option in themeOptions"
        :key="option.value"
        :variant="themePreference === option.value ? 'solid' : 'outline'"
        :aria-pressed="String(themePreference === option.value)"
        :data-testid="'theme-' + option.value"
        @click="themePreference = option.value"
      >
        <ui-icon :name="option.icon" :size="16" />
        {{ option.label }}
      </ui-button>
    </div>

    <div class="appearance-card__size">
      <span class="appearance-card__size-label">Text size</span>
      <ui-slider
        v-model="fontSize"
        :min="80"
        :max="130"
        :step="5"
        label="Text size"
        class="appearance-card__slider"
      />
      <span class="appearance-card__size-value" data-testid="font-size-value">{{ fontSize }}%</span>
    </div>
    <div v-if="fontSize !== defaultFontSize" class="appearance-card__reset">
      <ui-button variant="ghost" size="sm" data-testid="font-size-reset" @click="fontSize = defaultFontSize">
        Reset to default
      </ui-button>
    </div>
  </settings-card>
</template>

<style>
.appearance-card__themes {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
/* Mockup: 38px segment buttons */
.appearance-card__themes .ui-button {
  height: 2.375rem;
}
.appearance-card__size {
  display: flex;
  align-items: center;
  gap: 14px;
}
.appearance-card__size-label,
.appearance-card__size-value {
  flex: none;
  font-size: var(--text-sm);
  color: var(--muted);
}
.appearance-card__size-value {
  width: 2.5rem;
  text-align: right;
}
.appearance-card__slider {
  flex: 1;
}
.appearance-card__reset {
  margin-top: -6px;
  display: flex;
  justify-content: flex-end;
}
@media (max-width: 600px) {
  .appearance-card__size { gap: var(--space-3); }
}
</style>
