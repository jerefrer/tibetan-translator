<script>
import draggable from 'vuedraggable';
import { useTheme } from 'vuetify';

import Storage from '../services/storage';
import DictionariesDetails from '../services/dictionaries-details';

export default {
  components: {
    draggable,
  },
  inject: ['snackbar'],
  setup() {
    const theme = useTheme();
    return { theme };
  },
  data() {
    return {
      dictionaries: Storage.get('dictionaries').sort((a, b) => {
        return a.position - b.position;
      }),
      themePreference: Storage.get('themePreference') || 'system',
    };
  },
  watch: {
    dictionaries: {
      deep: true,
      handler(newDictionaries) {
        Storage.set(
          'dictionaries',
          newDictionaries.map((dictionary, index) => {
            return { ...dictionary, position: index + 1 };
          })
        );
      },
    },
    themePreference(value) {
      Storage.set('themePreference', value);
      this.applyTheme(value);
    },
  },
  methods: {
    applyTheme(preference) {
      let actualTheme;
      if (preference === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        actualTheme = prefersDark ? 'dark' : 'light';
      } else {
        actualTheme = preference;
      }
      this.theme.global.name.value = actualTheme;
      Storage.set('darkTheme', actualTheme === 'dark');
    },
    getDetails(dictionary) {
      return DictionariesDetails[dictionary.name] || {};
    },
    getLanguageLabel(dictionary) {
      const details = this.getDetails(dictionary);
      if (!details.language || !Array.isArray(details.language)) return '';
      // language is like ["tib", "<->", "en"] or ["tib", "->", "skt"]
      const langs = details.language.filter(l => !['<->', '->', '<-'].includes(l));
      const langNames = {
        tib: 'Tib',
        en: 'En',
        skt: 'Skt',
        zh: 'Zh',
      };
      return langs.map(l => langNames[l] || l).join(' ↔ ');
    },
    showDictionaryInfo(dictionary) {
      const details = this.getDetails(dictionary);
      if (!details.about) {
        this.snackbar.open(`<strong>${dictionary.name}</strong><br>No additional information available.`);
        return;
      }
      // Format the about text - split by | for line breaks
      const aboutHtml = details.about.split('|').join('<br>');
      this.snackbar.open(`<strong>${details.label || dictionary.name}</strong><br><br>${aboutHtml}`);
    },
  },
  created() {
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (this.themePreference === 'system') {
        this.applyTheme('system');
      }
    });
  },
};
</script>

<template>
  <v-container class="configure-page">
    <v-card class="theme-selector mb-4">
      <v-toolbar>
        <v-icon size="x-large" color="grey">mdi-theme-light-dark</v-icon>
        <v-toolbar-title>
          Theme
        </v-toolbar-title>
      </v-toolbar>
      <v-radio-group v-model="themePreference" inline hide-details class="pa-4">
        <v-radio label="System" value="system" />
        <v-radio label="Light" value="light" />
        <v-radio label="Dark" value="dark" />
      </v-radio-group>
    </v-card>

    <v-card class="dictionaries-container">
      <v-toolbar>
        <v-icon size="x-large" color="grey">mdi-book-multiple</v-icon>
        <v-toolbar-title>
          Dictionaries
          <div class="text-caption text-grey">
            Reorder or disable them to match your preferences
          </div>
        </v-toolbar-title>
      </v-toolbar>

      <draggable v-model="dictionaries" handle=".handle" item-key="id">
        <template #item="{ element: dictionary, index }">
          <div
            class="dictionary list-item"
            :class="{
              disabled: !dictionary.enabled,
            }"
          >
            <v-icon class="handle" color="grey-darken-2">
              mdi-drag-horizontal-variant
            </v-icon>

            <div class="name">
              <span class="text-grey-darken-1">{{ index + 1 }}.</span>
              {{ dictionary.name }}
              <span v-if="getLanguageLabel(dictionary)" class="language-label text-caption text-grey">
                ({{ getLanguageLabel(dictionary) }})
              </span>
            </div>

            <v-btn
              icon
              variant="text"
              size="small"
              class="info-button"
              @click.stop="showDictionaryInfo(dictionary)"
            >
              <v-icon size="small" color="grey">mdi-information-outline</v-icon>
            </v-btn>

            <v-switch
              v-model="dictionary.enabled"
              hide-details
              class="switch"
              color="primary"
            />
          </div>
        </template>
      </draggable>
    </v-card>
  </v-container>
</template>

<style lang="sass">
.configure-page
  margin-top: 30px

  .theme-selector
    width: 100%

    .v-toolbar .v-icon
      margin: 0 10px 0 10px

    .v-radio-group
      justify-content: center

  .dictionaries-container
    width: 100%

    .v-toolbar .v-icon
      margin: 0 10px 0 10px

    .v-toolbar__title, .v-toolbar__title .text-caption
      line-height: 1em

    .v-toolbar__title .text-caption
      margin-top: 5px

    .dictionary
      display: flex
      align-items: center
      user-select: none
      height: 42px
      border-bottom: thin solid rgba(0, 0, 0, 0.08)

      &:last-child
        border-bottom: none

      &.disabled .v-icon:before, &.disabled .switch .v-input__control
        opacity: 0.25

      &.disabled > .name
        color: #525252

      .handle
        width: 48px
        display: flex
        align-items: center
        justify-content: center
        cursor: move
        height: 100%

      .v-icon:before, .name, &.disabled .switch .v-input__control
        transition: all 1s

      > .name
        flex: 1
        padding: 0 8px
        white-space: nowrap
        overflow: hidden
        text-overflow: ellipsis
        min-width: 0

      > .info-button
        flex: 0 0 auto
        margin: 0 4px

      > .switch
        margin: 0
        flex: 0 0 auto
        padding-right: 8px

      .switch .v-input__control
        height: 32px

      .switch .v-selection-control
        min-height: 32px

  .database-reinitialization .v-toolbar .v-icon
    margin: 0 9px 0 -6px

    .fd-zone
      width: 100%

      > div:not(.dndtxt), > div:not(.dndtxt) form, > div:not(.dndtxt) form input
        position: absolute !important
        left: 0
        top: 0
        right: 0
        bottom: 0
        margin: 0

      > div:not(.dndtxt) form
        margin-top: -30px

// Mobile styles
@media (max-width: 600px)
  .configure-page
    margin-top: 15px
    padding: 0 8px

    .v-toolbar__content > .v-toolbar-title
      margin-inline-start: 0

    .dictionaries-container .dictionary
      .handle
        width: 32px

      > .name
        font-size: 14px

        .language-label
          display: none
</style>
